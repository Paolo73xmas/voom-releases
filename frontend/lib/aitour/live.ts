// Modalita' Live AI Tour (Fase 2): stato tour attivo, azioni sugli stop,
// integrazione con visite/appuntamenti CRM, suggerimenti di recupero tempo.
import { supabase } from '../supabase';
import * as Location from 'expo-location';
import type { TourCandidate, GeoPoint, AiTourSettings, EntityType, PriorityClass } from './types';
import { timeToMin, haversineKm } from './types';
import type { SavedTour, SavedStop } from './tours';
import { loadTourStops } from './tours';
import { loadFreeTabaccherie } from './data';

export type LiveStopStatus = 'planned' | 'arrived' | 'completed' | 'skipped' | 'cancelled';

export interface LiveStop {
  id: string;
  candidate: TourCandidate;
  status: LiveStopStatus;
  mandatory: boolean;
  plannedArrival: string | null;
  travelMinutes: number;
  travelKm: number;
  actualArrival: string | null;
  outcome: string | null;
  skipReason: string | null;
  addedLive: boolean;
  addedByAdmin: boolean;
}

export interface LiveState {
  tour: SavedTour;
  stops: LiveStop[];
  geometry: [number, number][];
  endPoint: GeoPoint | null;
  endMin: number;
}

export function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export async function getCurrentPos(): Promise<{ lat: number; lng: number } | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      if (!perm.canAskAgain) return null;
      perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function stopToCandidate(s: SavedStop & { outcome?: string | null; follow_up_date?: string | null }): TourCandidate {
  return {
    key: `${s.entity_type}:${s.customer_id || s.id}`,
    entityType: s.entity_type as EntityType,
    customerId: s.customer_id,
    tabaccheriaId: (s as { tabaccheria_id?: string | null }).tabaccheria_id || null,
    name: s.business_name,
    address: s.address || '',
    city: s.city || '',
    province: '',
    lat: Number(s.latitude),
    lng: Number(s.longitude),
    lastVisitDate: null,
    lastOrderDate: null,
    orderCount: 0,
    totalRevenue: 0,
    revenue6m: 0,
    avgOrderValue: 0,
    avgReorderDays: null,
    daysSinceOrder: null,
    daysSinceVisit: null,
    followUpDate: null,
    appointmentAt: null,
    notes: null,
    orphanStatus: null,
    estimatedRevenue: null,
    score: s.priority_score || 0,
    priorityClass: (s.priority_class || 'Media') as PriorityClass,
    reason: s.ai_reason || '',
    nextSuggestedVisit: null,
    visitMinutes: s.planned_duration_minutes || 20,
    preferredSlots: ((s as { preferred_slots?: TourCandidate['preferredSlots'] }).preferred_slots) || null,
    potentialValue: 0,
  };
}

export async function getActiveTour(agentId: string): Promise<SavedTour | null> {
  const { data, error } = await supabase
    .from('ai_tours')
    .select('id, agent_id, tour_date, start_time, end_time, start_label, start_lat, start_lng, end_label, end_lat, end_lng, tour_type, resolved_tour_type, status, planned_visits, planned_distance_km, planned_drive_minutes, planned_visit_minutes, planned_buffer_minutes, potential_value, ai_summary, created_at, lunch_break_start, lunch_break_end, lunch_break_minutes, area_filter')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[AITour][live] getActiveTour:', error);
    return null;
  }
  return data as SavedTour | null;
}

export async function loadLiveState(tour: SavedTour): Promise<LiveState> {
  const { stops, geometry } = await loadTourStops(tour.id);
  const ordered = [...stops].sort((a, b) => {
    const sa = (a as { actual_sequence?: number | null }).actual_sequence ?? a.planned_sequence;
    const sb = (b as { actual_sequence?: number | null }).actual_sequence ?? b.planned_sequence;
    return sa - sb;
  });
  // Nome commerciale della scheda CRM collegata (se leggibile via RLS): mostrato quando
  // la denominazione del registro sulla tappa differisce dal nome commerciale
  const crmNames = new Map<string, string>();
  const linkedIds = [...new Set(ordered.map((s) => s.customer_id).filter((x): x is string => !!x))];
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase.from('customers').select('id, business_name').in('id', linkedIds);
    for (const c of linked || []) crmNames.set(c.id as string, (c.business_name as string) || '');
  }
  return {
    tour,
    stops: ordered.map((s) => ({
      id: s.id,
      candidate: { ...stopToCandidate(s), crmName: s.customer_id ? crmNames.get(s.customer_id) || null : null },
      status: (s.status as LiveStopStatus) || 'planned',
      mandatory: s.mandatory,
      plannedArrival: s.planned_arrival,
      travelMinutes: s.travel_minutes || 0,
      travelKm: Number(s.travel_km || 0),
      actualArrival: (s as { actual_arrival?: string | null }).actual_arrival || null,
      outcome: (s as { outcome?: string | null }).outcome || null,
      skipReason: (s as { skip_reason?: string | null }).skip_reason || null,
      addedLive: !!(s as { added_live?: boolean }).added_live,
      addedByAdmin: !!(s as { added_by_admin?: boolean }).added_by_admin,
    })),
    geometry,
    endPoint: tour.end_lat != null ? { lat: tour.end_lat, lng: tour.end_lng as number, label: tour.end_label || 'Rientro' } : null,
    endMin: timeToMin(tour.end_time),
  };
}

async function logEvent(tourId: string, eventType: string, stopId: string | null, details: Record<string, unknown> = {}) {
  await supabase.from('ai_tour_events').insert({ tour_id: tourId, stop_id: stopId, event_type: eventType, details });
}

export const logTourEvent = logEvent;

export async function startLiveTour(tourId: string): Promise<void> {
  // Il giorno di esecuzione reale e' OGGI: riallinea tour_date (es. tour generato
  // per domani ma avviato oggi) cosi' Monitoring, report e storici restano coerenti.
  const d = new Date();
  const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Un agente ha un solo giro live: chiudi eventuali tour rimasti attivi (es. giro abbandonato)
  const { data: cur } = await supabase.from('ai_tours').select('agent_id').eq('id', tourId).single();
  if (cur?.agent_id) {
    const { data: others } = await supabase
      .from('ai_tours')
      .select('id')
      .eq('agent_id', cur.agent_id)
      .eq('status', 'active')
      .neq('id', tourId);
    for (const o of others || []) {
      await supabase
        .from('ai_tour_stops')
        .update({ status: 'cancelled', skip_reason: 'Giro chiuso automaticamente: avviato un nuovo tour' })
        .eq('tour_id', o.id)
        .in('status', ['planned', 'arrived']);
      await supabase
        .from('ai_tours')
        .update({ status: 'completed', actual_end: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', o.id);
      await logEvent(o.id, 'closed_by_new_tour', null, { new_tour_id: tourId });
    }
  }
  const { error } = await supabase
    .from('ai_tours')
    .update({ status: 'active', tour_date: localToday, actual_start: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', tourId);
  if (error) throw error;
  await logEvent(tourId, 'started', null);
}

export async function markArrived(tourId: string, stopId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tour_stops')
    .update({ status: 'arrived', actual_arrival: new Date().toISOString() })
    .eq('id', stopId);
  if (error) throw error;
  await logEvent(tourId, 'arrived', stopId);
}

export interface EsitoData {
  outcome: string;
  note: string;
  followUpDate: string | null;
  followUpTime?: string | null;
}

export async function completeStop(tour: SavedTour, stop: LiveStop, esito: EsitoData): Promise<void> {
  const now = new Date();
  const durationMin = stop.actualArrival
    ? Math.max(1, Math.round((now.getTime() - new Date(stop.actualArrival).getTime()) / 60000))
    : stop.candidate.visitMinutes;
  const { error } = await supabase
    .from('ai_tour_stops')
    .update({
      status: 'completed',
      actual_end: now.toISOString(),
      actual_arrival: stop.actualArrival || now.toISOString(),
      actual_duration_minutes: durationMin,
      outcome: esito.outcome,
      outcome_note: esito.note || null,
      follow_up_date: esito.followUpDate,
    })
    .eq('id', stop.id);
  if (error) throw error;
  await logEvent(tour.id, 'completed', stop.id, { outcome: esito.outcome, duration_min: durationMin });

  // Integrazione col CRM: registra la visita e l'eventuale follow-up (solo soggetti con scheda cliente)
  if (stop.candidate.customerId) {
    // visits accetta solo questi valori (check constraint): mappa l'esito AI Tour
    const OUTCOME_TO_VISIT: Record<string, string> = {
      ordine: 'positive', trattativa: 'positive', interessato: 'positive',
      molto_interessato: 'positive', appuntamento_fissato: 'positive',
      non_interessato: 'negative', chiuso: 'negative',
      da_richiamare: 'neutral', titolare_assente: 'neutral', non_trovato: 'neutral',
      ispezione: 'neutral', altro: 'neutral',
    };
    try {
      const { error: visitErr } = await supabase.from('visits').insert({
        customer_id: stop.candidate.customerId,
        agent_id: tour.agent_id,
        visit_type: 'follow_up',
        visit_date: now.toISOString(),
        latitude: stop.candidate.lat,
        longitude: stop.candidate.lng,
        gps_accuracy: 0,
        notes: `[AI Tour] Esito: ${esito.outcome}${esito.note ? ` — ${esito.note}` : ''}`,
        outcome: OUTCOME_TO_VISIT[esito.outcome] || 'neutral',
        next_appointment_date: esito.followUpDate,
      });
      if (visitErr) console.warn('[AITour][live] insert visita CRM fallito:', visitErr.message);
    } catch (err) {
      console.warn('[AITour][live] insert visita CRM fallito:', err);
    }
    if (esito.followUpDate) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const { error: apptErr } = await supabase.from('appointments').insert({
          customer_id: stop.candidate.customerId,
          agent_id: tour.agent_id,
          created_by_id: session.session?.user.id || tour.agent_id,
          appointment_date: `${esito.followUpDate}T${esito.followUpTime || '09:00'}:00`,
          duration_minutes: 30,
          appointment_type: 'follow_up',
          status: 'scheduled',
          notes: `[AI Tour] Follow-up: ${esito.outcome}${esito.note ? ` — ${esito.note}` : ''}`,
        });
        if (apptErr) console.warn('[AITour][live] insert appuntamento follow-up fallito:', apptErr.message);
      } catch (err) {
        console.warn('[AITour][live] insert appuntamento follow-up fallito:', err);
      }
    }
  }
}

export async function skipStop(tourId: string, stopId: string, reason: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tour_stops')
    .update({ status: 'skipped', skip_reason: note ? `${reason}: ${note}` : reason })
    .eq('id', stopId);
  if (error) throw error;
  await logEvent(tourId, 'skipped', stopId, { reason, note });
}

export const TRASH_REASON = "Visita cestinata dall'agente";

// Visita cestinata dall'agente: esce dal giro (il caller ricalcola) e viene segnalata come tale
export async function trashStop(tourId: string, stopId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tour_stops')
    .update({ status: 'cancelled', skip_reason: TRASH_REASON })
    .eq('id', stopId);
  if (error) throw error;
  await logEvent(tourId, 'stop_trashed', stopId, { stop: name });
}

// Ripasso in giornata: la tappa resta nel giro con una finestra oraria attorno
// all'ora scelta (l'AI la riposiziona al prossimo ricalcolo). Non viene mai
// rimossa dai ricalcoli (guardia isRevisitCandidate lato client).
export function revisitSlotFor(time: string): { id: string; label: string; start: number; end: number; strict: boolean } {
  const [h, m] = time.split(':').map(Number);
  const start = h * 60 + (m || 0);
  // strict: nessuna tolleranza ±30 del planner, l'arrivo resta in [ora-15, ora+45]
  return { id: `ripasso_${time.replace(':', '')}`, label: `Ripasso ${time}`, start: Math.max(0, start - 15), end: start + 45, strict: true };
}

export const isRevisitCandidate = (c: TourCandidate): boolean =>
  (c.preferredSlots || []).some((s) => s.id.startsWith('ripasso_'));

export async function scheduleRevisit(tourId: string, stopId: string, time: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tour_stops')
    .update({ status: 'planned', actual_arrival: null, preferred_slots: [revisitSlotFor(time)], skip_reason: null })
    .eq('id', stopId);
  if (error) throw error;
  await logEvent(tourId, 'revisit_scheduled', stopId, { time, reason });
}

// Pausa Pranzo: utilizzabile una sola volta al giorno; registrata sul tour per Monitoring/storico
export async function startLunchBreak(tourId: string, agentId: string, minutes: number): Promise<void> {
  const d = new Date();
  const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data: used, error: checkErr } = await supabase
    .from('ai_tours')
    .select('id')
    .eq('agent_id', agentId)
    .eq('tour_date', localToday)
    .not('lunch_break_start', 'is', null)
    .limit(1);
  if (checkErr) throw checkErr;
  if ((used || []).length > 0) throw new Error('La Pausa Pranzo è già stata utilizzata oggi');
  const { error } = await supabase
    .from('ai_tours')
    .update({ lunch_break_start: new Date().toISOString(), lunch_break_end: null, lunch_break_minutes: minutes })
    .eq('id', tourId);
  if (error) throw error;
  await logEvent(tourId, 'lunch_break_started', null, { minutes });
}

export async function endLunchBreak(tourId: string, actualMinutes: number): Promise<void> {
  await supabase.from('ai_tours').update({ lunch_break_end: new Date().toISOString() }).eq('id', tourId);
  await logEvent(tourId, 'lunch_break_ended', null, { actual_minutes: actualMinutes });
}

// "Più Visite": l'agente posticipa l'orario di fine giro (formato HH:MM)
export async function extendTourEndTime(tourId: string, endTime: string): Promise<void> {
  const { error } = await supabase.from('ai_tours').update({ end_time: endTime }).eq('id', tourId);
  if (error) throw error;
  await logEvent(tourId, 'end_time_extended', null, { end_time: endTime });
}

export async function cancelStopByRecalc(tourId: string, stopId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tour_stops')
    .update({ status: 'cancelled', skip_reason: 'Rimossa dal ricalcolo AI: fuori orario' })
    .eq('id', stopId);
  if (error) throw error;
  await logEvent(tourId, 'cancelled_by_recalc', stopId);
}

export async function updateLiveSequence(
  tourId: string,
  updates: { stopId: string; seq: number; arrival: string; travelMin: number; travelKm: number }[],
): Promise<void> {
  for (const u of updates) {
    await supabase
      .from('ai_tour_stops')
      .update({ actual_sequence: u.seq, planned_arrival: u.arrival, travel_minutes: Math.round(u.travelMin), travel_km: Math.round(u.travelKm * 10) / 10 })
      .eq('id', u.stopId);
  }
  await logEvent(tourId, 'recalc', null, { stops: updates.length });
}

export interface AddStopOpts {
  mandatory?: boolean;
  byAdmin?: boolean;
  adminName?: string;
  placement?: string;
}

export async function addLiveStop(tour: SavedTour, cand: TourCandidate, seq: number, opts: AddStopOpts = {}): Promise<string> {
  const { data, error } = await supabase
    .from('ai_tour_stops')
    .insert({
      tour_id: tour.id,
      entity_type: cand.entityType,
      customer_id: cand.customerId,
      tabaccheria_id: cand.tabaccheriaId,
      business_name: cand.name,
      address: cand.address,
      city: cand.city,
      province: cand.province,
      latitude: cand.lat,
      longitude: cand.lng,
      planned_sequence: seq,
      actual_sequence: seq,
      planned_duration_minutes: cand.visitMinutes,
      priority_score: cand.score,
      priority_class: cand.priorityClass,
      mandatory: !!opts.mandatory,
      status: 'planned',
      ai_reason: cand.reason,
      preferred_slots: cand.preferredSlots || null,
      added_live: true,
      added_by_admin: !!opts.byAdmin,
    })
    .select('id')
    .single();
  if (error) throw error;
  await logEvent(tour.id, opts.byAdmin ? 'added_by_admin' : 'added_live', data.id, {
    name: cand.name,
    placement: opts.placement || null,
    mandatory: !!opts.mandatory,
    ...(opts.adminName ? { admin_name: opts.adminName } : {}),
  });
  return data.id as string;
}

export async function finishLiveTour(tourId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tours')
    .update({ status: 'completed', actual_end: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', tourId);
  if (error) throw error;
  await logEvent(tourId, 'finished', null);
}

// Battito posizione: aggiorna l'ultimo GPS del tour per il Monitoring admin
export async function updateTourPosition(tourId: string, lat: number, lng: number): Promise<void> {
  await supabase
    .from('ai_tours')
    .update({ last_lat: lat, last_lng: lng, last_position_at: new Date().toISOString() })
    .eq('id', tourId);
}

// Traccia percorso reale: salva un punto GPS nella tabella di tracking condivisa
export async function recordTrackPoint(agentId: string, lat: number, lng: number): Promise<void> {
  await supabase
    .from('app_4d4e73c9f0_gps_tracking')
    .insert({ user_id: agentId, latitude: lat, longitude: lng, timestamp: Date.now() });
}

// Acquisizione prospect dal tour: cliente collegato alla tabaccheria dopo la Prima Visita
export async function findTabCustomer(tabaccheriaId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tabaccherie')
    .select('customer_id')
    .eq('id', tabaccheriaId)
    .single();
  if (error) {
    console.warn('[AITour][live] findTabCustomer:', error);
    return null;
  }
  return (data?.customer_id as string | null) || null;
}

export async function updateStopCustomer(stopId: string, customerId: string, entityType?: string): Promise<void> {
  // Solo i punti vendita "da acquisire" diventano prospect; gli orfani mantengono il loro tipo
  const patch: Record<string, unknown> = { customer_id: customerId };
  if (entityType === 'free' || entityType === 'never') patch.entity_type = 'prospect';
  await supabase
    .from('ai_tour_stops')
    .update(patch)
    .eq('id', stopId);
}

// Verifica se dopo l'apertura della sezione esterna e' stato creato un ordine/ispezione per il cliente
export async function findExternalResult(kind: 'inspection' | 'order', customerId: string, sinceIso: string): Promise<boolean> {
  const table = kind === 'order' ? 'orders' : 'inspections';
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('customer_id', customerId)
    .gte('created_at', sinceIso)
    .limit(1);
  if (error) {
    console.warn('[AITour][live] findExternalResult:', error);
    return false;
  }
  return (data || []).length > 0;
}

// Livello superiore di intelligenza: tabaccherie da acquisire a MENO DI 3 KM dalla
// posizione dell'agente o dal percorso rimanente -> avviso immediato nel Live.
export const PROXIMITY_KM = 3;

export async function suggestNearbyProximity(
  pos: { lat: number; lng: number },
  routePoints: { lat: number; lng: number }[],
  excludeTabIds: Set<string>,
  settings: AiTourSettings,
  inArea: (c: { lat: number; lng: number; province?: string; city?: string }) => boolean,
): Promise<(TourCandidate & { distKm: number }) | null> {
  const d = 0.04; // box ~4 km attorno alla posizione
  const free = await loadFreeTabaccherie(
    { minLat: pos.lat - d, maxLat: pos.lat + d, minLng: pos.lng - d, maxLng: pos.lng + d },
    excludeTabIds,
    settings,
    { refLat: pos.lat, refLng: pos.lng },
    15,
  );
  let best: TourCandidate | null = null;
  let bestKm = Infinity;
  for (const c of free) {
    if (!inArea(c)) continue;
    let km = haversineKm(pos.lat, pos.lng, c.lat, c.lng);
    for (const p of routePoints) {
      const k = haversineKm(p.lat, p.lng, c.lat, c.lng);
      if (k < km) km = k;
    }
    if (km <= PROXIMITY_KM && km < bestKm) { best = c; bestKm = km; }
  }
  if (!best) return null;
  best.reason = "Tabaccheria da acquisire a meno di 3 km: opportunita' immediata";
  return Object.assign(best, { distKm: Math.round(bestKm * 10) / 10 });
}

// Recupero tempo: cerca una tabaccheria libera vicina alla posizione corrente
export async function suggestNearby(
  pos: { lat: number; lng: number },
  excludeTabIds: Set<string>,
  settings: AiTourSettings,
): Promise<TourCandidate | null> {
  const d = 0.07; // ~7 km
  const free = await loadFreeTabaccherie(
    { minLat: pos.lat - d, maxLat: pos.lat + d, minLng: pos.lng - d, maxLng: pos.lng + d },
    excludeTabIds,
    settings,
    { refLat: pos.lat, refLng: pos.lng },
    5,
  );
  if (free.length === 0) return null;
  const best = free[0];
  best.score = 30;
  best.priorityClass = 'Bassa';
  best.reason = 'Tabaccheria non assegnata nelle vicinanze: opportunita\' di sviluppo';
  return best;
}
