// Modalita' Live AI Tour (Fase 2): stato tour attivo, azioni sugli stop,
// integrazione con visite/appuntamenti CRM, suggerimenti di recupero tempo.
import { supabase } from '../supabase';
import * as Location from 'expo-location';
import type { TourCandidate, GeoPoint, AiTourSettings, EntityType, PriorityClass } from './types';
import { timeToMin } from './types';
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
    potentialValue: 0,
  };
}

export async function getActiveTour(agentId: string): Promise<SavedTour | null> {
  const { data, error } = await supabase
    .from('ai_tours')
    .select('id, agent_id, tour_date, start_time, end_time, start_label, start_lat, start_lng, end_label, end_lat, end_lng, tour_type, resolved_tour_type, status, planned_visits, planned_distance_km, planned_drive_minutes, planned_visit_minutes, planned_buffer_minutes, potential_value, ai_summary, created_at')
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
  return {
    tour,
    stops: ordered.map((s) => ({
      id: s.id,
      candidate: stopToCandidate(s),
      status: (s.status as LiveStopStatus) || 'planned',
      mandatory: s.mandatory,
      plannedArrival: s.planned_arrival,
      travelMinutes: s.travel_minutes || 0,
      travelKm: Number(s.travel_km || 0),
      actualArrival: (s as { actual_arrival?: string | null }).actual_arrival || null,
      outcome: (s as { outcome?: string | null }).outcome || null,
      skipReason: (s as { skip_reason?: string | null }).skip_reason || null,
    })),
    geometry,
    endPoint: tour.end_lat != null ? { lat: tour.end_lat, lng: tour.end_lng as number, label: tour.end_label || 'Rientro' } : null,
    endMin: timeToMin(tour.end_time),
  };
}

async function logEvent(tourId: string, eventType: string, stopId: string | null, details: Record<string, unknown> = {}) {
  await supabase.from('ai_tour_events').insert({ tour_id: tourId, stop_id: stopId, event_type: eventType, details });
}

export async function startLiveTour(tourId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_tours')
    .update({ status: 'active', actual_start: new Date().toISOString(), updated_at: new Date().toISOString() })
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
    try {
      await supabase.from('visits').insert({
        customer_id: stop.candidate.customerId,
        agent_id: tour.agent_id,
        visit_type: 'ai_tour',
        visit_date: now.toISOString(),
        latitude: stop.candidate.lat,
        longitude: stop.candidate.lng,
        gps_accuracy: 0,
        notes: `[AI Tour] ${esito.note || ''}`.trim(),
        outcome: esito.outcome,
        next_appointment_date: esito.followUpDate,
      });
    } catch (err) {
      console.warn('[AITour][live] insert visita CRM fallito:', err);
    }
    if (esito.followUpDate) {
      try {
        const { data: session } = await supabase.auth.getSession();
        await supabase.from('appointments').insert({
          customer_id: stop.candidate.customerId,
          agent_id: tour.agent_id,
          created_by_id: session.session?.user.id || tour.agent_id,
          appointment_date: `${esito.followUpDate}T09:00:00`,
          duration_minutes: 30,
          appointment_type: 'follow_up',
          status: 'scheduled',
          notes: `[AI Tour] Follow-up: ${esito.outcome}${esito.note ? ` — ${esito.note}` : ''}`,
        });
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

export async function addLiveStop(tour: SavedTour, cand: TourCandidate, seq: number): Promise<string> {
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
      mandatory: false,
      status: 'planned',
      ai_reason: cand.reason,
    })
    .select('id')
    .single();
  if (error) throw error;
  await logEvent(tour.id, 'added_live', data.id, { name: cand.name });
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

export async function updateStopCustomer(stopId: string, customerId: string): Promise<void> {
  await supabase
    .from('ai_tour_stops')
    .update({ customer_id: customerId, entity_type: 'prospect' })
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

// Recupero tempo: cerca una tabaccheria libera vicina alla posizione corrente
export async function suggestNearby(
  pos: { lat: number; lng: number },
  excludeTabIds: Set<string>,
  settings: AiTourSettings,
): Promise<TourCandidate | null> {
  const d = 0.03; // ~3 km
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
