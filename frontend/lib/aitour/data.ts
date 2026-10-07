// Caricamento candidati AI Tour: clienti, prospect (customers dell'agente) + orfani (RPC + tabaccherie).
import { supabase } from '../supabase';
import { getOrphanConfig, fetchOrphanMap } from '../api/orphan-claims';
import type { TourCandidate, EntityType, AiTourSettings } from './types';
import { daysSince } from './types';
import { getVisitSlots, resolveSlots, type VisitSlot } from '../visit-slots';

interface OrderStats {
  customer_id: string;
  order_count: number;
  last_order_date: string | null;
  total_revenue: number;
  revenue_6m: number;
  avg_order_value: number;
  avg_reorder_days: number | null;
}

interface CustomerRow {
  disabled?: boolean;
  id: string;
  business_name: string;
  category: string;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  last_visit_date: string | null;
  last_order_date: string | null;
  notes: string | null;
  estimated_revenue: number | null;
  tabaccheria_id: string | null;
  project_type: string | null;
  preferred_visit_slots: unknown;
  excluded_visit_days: unknown;
}

// Progetti Speciali: slug -> nome visualizzato
async function fetchProjectsMap(strict = false): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase.from('projects').select('slug, name').eq('is_active', true);
  if (error) {
    console.warn('[AITour][data] projects:', error);
    if (strict) throw new Error('Elenco progetti non verificato. Riprova.');
    return map;
  }
  for (const p of data || []) if (p.slug && p.slug !== 'nessun_progetto') map.set(p.slug, p.name || p.slug);
  return map;
}

async function fetchOrderStats(customerIds: string[], strict = false): Promise<Map<string, OrderStats>> {
  const map = new Map<string, OrderStats>();
  for (let i = 0; i < customerIds.length; i += 200) {
    const batch = customerIds.slice(i, i + 200);
    const { data, error } = await supabase.rpc('ai_tour_order_stats', { p_customer_ids: batch });
    if (error) {
      console.error('[AITour][data] ai_tour_order_stats:', error);
      if (strict) throw new Error('Statistiche ordini non verificate. Riprova.');
      continue;
    }
    for (const row of (data || []) as OrderStats[]) map.set(row.customer_id, row);
  }
  return map;
}

// Ultimo ordine telefonico/remoto (90 gg) per cliente: non vale come contatto di persona
// Durate visita apprese dalle durate reali dei tour completati (RPC aggregata)
interface LearnedDuration { avg: number; samples: number }
async function fetchLearnedDurations(agentId: string): Promise<Map<string, LearnedDuration>> {
  const map = new Map<string, LearnedDuration>();
  const { data, error } = await supabase.rpc('ai_tour_learned_durations', { p_agent_id: agentId });
  if (error) {
    console.warn('[AITour][data] learned durations:', error);
    return map;
  }
  for (const r of (data || []) as { customer_id: string; avg_minutes: number; samples: number }[]) {
    if (r.customer_id && Number.isFinite(Number(r.avg_minutes))) {
      map.set(r.customer_id, { avg: Number(r.avg_minutes), samples: Number(r.samples) });
    }
  }
  return map;
}

async function fetchLastRemoteOrders(agentId: string): Promise<Map<string, { date: string; amount: number }>> {
  const map = new Map<string, { date: string; amount: number }>();
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, order_date, total_amount')
    .eq('agent_id', agentId)
    .eq('order_channel', 'remoto')
    .eq('is_deleted', false)
    .gte('order_date', new Date(Date.now() - 90 * 86400000).toISOString())
    .order('order_date', { ascending: false });
  if (error) {
    console.warn('[AITour][data] ordini remoti:', error);
    return map;
  }
  for (const r of (data || []) as { customer_id: string; order_date: string; total_amount: number | null }[]) {
    if (r.customer_id && !map.has(r.customer_id)) {
      map.set(r.customer_id, { date: r.order_date, amount: Number(r.total_amount || 0) });
    }
  }
  return map;
}

async function fetchUpcomingAppointments(agentId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase
    .from('appointments')
    .select('customer_id, appointment_date, appointment_type, status')
    .is('completed_at', null)
    .eq('agent_id', agentId)
    .eq('status', 'scheduled')
    .gte('appointment_date', new Date().toISOString());
  if (error) {
    console.warn('[AITour][data] appointments:', error);
    return map;
  }
  for (const a of data || []) {
    if (!a.customer_id) continue;
    const prev = map.get(a.customer_id);
    if (!prev || a.appointment_date < prev) map.set(a.customer_id, a.appointment_date);
  }
  return map;
}

function toCandidate(
  c: CustomerRow,
  entityType: EntityType,
  stats: OrderStats | undefined,
  appointmentAt: string | null,
  settings: AiTourSettings,
  orphanStatus: 'orphan_a' | 'orphan_b' | null,
  projects?: Map<string, string>,
  remote?: { date: string; amount: number },
  learned?: LearnedDuration,
  slotDefs?: VisitSlot[],
): TourCandidate {
  const lastOrder = stats?.last_order_date || c.last_order_date || null;
  const projectType = c.project_type && c.project_type !== 'nessun_progetto' ? c.project_type : null;
  const defaultMinutes =
    entityType === 'client' ? settings.visit_minutes_client
    : entityType === 'prospect' ? settings.visit_minutes_prospect
    : settings.visit_minutes_orphan;
  // Durata appresa: media reale con shrinkage verso il default (peso prior 2)
  let visitMinutes = defaultMinutes;
  let visitLearnedSamples: number | undefined;
  if (learned && learned.samples > 0) {
    visitMinutes = Math.min(90, Math.max(5, Math.round((learned.avg * learned.samples + defaultMinutes * 2) / (learned.samples + 2))));
    visitLearnedSamples = learned.samples;
  }
  return {
    key: `${entityType}:${c.id}`,
    entityType,
    customerId: c.id,
    tabaccheriaId: c.tabaccheria_id,
    name: c.business_name,
    address: c.address || '',
    city: c.city || '',
    province: c.province || '',
    lat: Number(c.latitude),
    lng: Number(c.longitude),
    lastVisitDate: c.last_visit_date,
    lastOrderDate: lastOrder,
    orderCount: stats?.order_count || 0,
    totalRevenue: Number(stats?.total_revenue || 0),
    revenue6m: Number(stats?.revenue_6m || 0),
    avgOrderValue: Number(stats?.avg_order_value || 0),
    avgReorderDays: stats?.avg_reorder_days != null ? Number(stats.avg_reorder_days) : null,
    daysSinceOrder: daysSince(lastOrder),
    daysSinceVisit: daysSince(c.last_visit_date),
    lastRemoteOrderDate: remote?.date || null,
    lastRemoteOrderAmount: remote != null ? remote.amount : null,
    followUpDate: null,
    appointmentAt,
    notes: c.notes,
    orphanStatus,
    estimatedRevenue: c.estimated_revenue,
    projectType,
    projectName: projectType ? (projects?.get(projectType) || projectType) : null,
    score: 0,
    priorityClass: 'Bassa',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes,
    visitLearnedSamples,
    preferredSlots: resolveSlots(c.preferred_visit_slots, slotDefs || []),
    excludedDays: Array.isArray(c.excluded_visit_days) && c.excluded_visit_days.length > 0 ? (c.excluded_visit_days as number[]) : null,
    potentialValue: 0,
  };
}

export interface CandidatePool {
  registry?: TourCandidate[];
  clients: TourCandidate[];
  prospects: TourCandidate[];
  orphans: TourCandidate[];
}

// "Non interessato" negli ultimi 6 mesi (di qualunque agente): l'AI non ripropone
// il punto vendita. Cache 5 minuti (il check di prossimita' live gira ogni minuto).
export interface NoInterestBlock {
  customers: Map<string, string>;
  tabs: Map<string, string>;
}

let noInterestCache: { at: number; block: NoInterestBlock } | null = null;

export async function getNoInterestBlock(strict = false): Promise<NoInterestBlock> {
  if (noInterestCache && Date.now() - noInterestCache.at < 300000) return noInterestCache.block;
  const block: NoInterestBlock = { customers: new Map(), tabs: new Map() };
  const { data, error } = await supabase.rpc('ai_tour_no_interest_ids');
  if (error) {
    console.warn('[AITour][data] no-interest block:', error);
    if (strict) throw new Error('Esclusioni commerciali non verificate. Riprova.');
    return block;
  }
  for (const r of (data || []) as { customer_id: string | null; tabaccheria_id: string | null; last_no_interest: string }[]) {
    if (r.customer_id) {
      const prev = block.customers.get(r.customer_id);
      if (!prev || r.last_no_interest > prev) block.customers.set(r.customer_id, r.last_no_interest);
    }
    if (r.tabaccheria_id) {
      const prev = block.tabs.get(r.tabaccheria_id);
      if (!prev || r.last_no_interest > prev) block.tabs.set(r.tabaccheria_id, r.last_no_interest);
    }
  }
  noInterestCache = { at: Date.now(), block };
  return block;
}

// Torna proponibile prima dei 6 mesi solo se DOPO il "no" c'e' stato un ordine
// o c'e' un appuntamento futuro fissato (segnali di interesse ritrovato).
export function isNoInterestBlocked(c: TourCandidate, block: NoInterestBlock): boolean {
  const dates: string[] = [];
  if (c.customerId && block.customers.has(c.customerId)) dates.push(block.customers.get(c.customerId)!);
  if (c.tabaccheriaId && block.tabs.has(c.tabaccheriaId)) dates.push(block.tabs.get(c.tabaccheriaId)!);
  if (dates.length === 0) return false;
  const last = dates.sort()[dates.length - 1];
  if (c.appointmentAt) return false;
  if (c.lastOrderDate && c.lastOrderDate.slice(0, 10) > last) return false;
  return true;
}

export async function loadCandidates(agentId: string, settings: AiTourSettings, strict = false): Promise<CandidatePool> {
  if (!agentId) throw new Error('Sessione agente non disponibile');
  const customers: CustomerRow[] = [];
  for (let offset = 0; ; offset += 500) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, business_name, category, address, city, province, latitude, longitude, last_visit_date, last_order_date, notes, estimated_revenue, tabaccheria_id, project_type, preferred_visit_slots, excluded_visit_days')
    .eq('agent_id', agentId)
    .eq('disabled', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null).order('id').range(offset, offset + 499);
  if (error) throw error;
  customers.push(...(data || []) as CustomerRow[]);
  if (!data || data.length < 500) break;
  }

  const rows = ((customers || []) as CustomerRow[]).filter(
    (r) => !r.disabled && Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
  );
  const clientRows = rows.filter((r) => r.category === 'client');
  const prospectRows = rows.filter((r) => r.category === 'prospect' || r.category === 'lead');

  const [stats, appointments, orphanConfig, projects, remoteOrders, learnedDurations, slotDefs, noBlock] = await Promise.all([
    fetchOrderStats(clientRows.map((r) => r.id), strict),
    fetchUpcomingAppointments(agentId),
    getOrphanConfig(),
    fetchProjectsMap(strict),
    fetchLastRemoteOrders(agentId),
    fetchLearnedDurations(agentId),
    getVisitSlots(strict),
    getNoInterestBlock(strict),
  ]);
  if (strict && !orphanConfig.id) throw new Error('Configurazione orfani non verificata. Nessuna regola CRM è stata sostituita.');
  const orphanMap = await fetchOrphanMap(orphanConfig, strict);

  // Orfani propri (schede dell'agente — clienti E prospect — con tabaccheria diventata orfana):
  // una sola voce candidato (dati CRM completi + badge orfano), MAI doppione dal registro tabaccherie
  const ownOrphanKeys = new Set<string>();
  const orphans: TourCandidate[] = [];
  for (const r of [...clientRows, ...prospectRows]) {
    const status = r.tabaccheria_id ? orphanMap.get(r.tabaccheria_id) : undefined;
    if (status) {
      orphans.push({ ...toCandidate(r, 'orphan', stats.get(r.id), appointments.get(r.id) || null, settings, status, projects, remoteOrders.get(r.id), learnedDurations.get(r.id), slotDefs), isOwnOrphan: true });
      if (r.tabaccheria_id) ownOrphanKeys.add(r.tabaccheria_id);
    }
  }

  // Orfani da registro tabaccherie (altri agenti / non assegnati): solo dati anagrafici
  const otherOrphanIds = [...orphanMap.keys()].filter((id) => !ownOrphanKeys.has(id));
  for (let i = 0; i < otherOrphanIds.length; i += 300) {
    const batch = otherOrphanIds.slice(i, i + 300);
    const { data: tabs, error: tabErr } = await supabase
      .from('tabaccherie')
      .select('id, denominazione, codice_rivendita, indirizzo, comune, provincia, gps_lat, gps_lng, customer_id')
      .in('id', batch)
      .eq('chiusa', false)
      .not('gps_lat', 'is', null)
      .not('gps_lng', 'is', null);
    if (tabErr) {
      console.warn('[AITour][data] tabaccherie orfane:', tabErr);
      if (strict) throw new Error('Registro orfani incompleto. Riprova.');
      continue;
    }
    // Nome commerciale della scheda CRM collegata (se leggibile: RLS puo' filtrare i clienti altrui)
    const linkedIds = (tabs || []).map((t) => t.customer_id as string | null).filter((x): x is string => !!x);
    const crmNames = new Map<string, string>();
    const crmSlots = new Map<string, unknown>();
    const crmExDays = new Map<string, unknown>();
    const disabledCustomers = new Set<string>();
    if (linkedIds.length > 0) {
      const { data: linked, error: linkedError } = await supabase.from('customers').select('id, business_name, preferred_visit_slots, excluded_visit_days, disabled').in('id', linkedIds);
      if (linkedError) throw linkedError;
      for (const c of linked || []) {
        if (c.disabled) disabledCustomers.add(c.id);
        crmNames.set(c.id as string, (c.business_name as string) || '');
        crmSlots.set(c.id as string, (c as { preferred_visit_slots?: unknown }).preferred_visit_slots);
        crmExDays.set(c.id as string, (c as { excluded_visit_days?: unknown }).excluded_visit_days);
      }
    }
    for (const t of tabs || []) {
      const status = orphanMap.get(t.id) || null;
      const lat = Number(t.gps_lat);
      const lng = Number(t.gps_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const linkedCustomerId = (t.customer_id as string | null) || null;
      if (linkedCustomerId && disabledCustomers.has(linkedCustomerId)) continue;
      orphans.push({
        key: `orphan:${t.id}`,
        isOwnOrphan: false,
        entityType: 'orphan',
        customerId: linkedCustomerId,
        // Cliente di altro agente (invisibile via RLS): id usato SOLO per lo
        // storico ordini del badge Orfano (RPC SECURITY DEFINER a dato minimo)
        historyCustomerId: t.customer_id || null,
        tabaccheriaId: t.id,
        name: t.denominazione || `Tabaccheria Riv. ${t.codice_rivendita || ''}`.trim(),
        crmName: linkedCustomerId ? crmNames.get(linkedCustomerId) || null : null,
        preferredSlots: linkedCustomerId ? resolveSlots(crmSlots.get(linkedCustomerId), slotDefs) : null,
        excludedDays: linkedCustomerId && Array.isArray(crmExDays.get(linkedCustomerId)) && (crmExDays.get(linkedCustomerId) as number[]).length > 0 ? (crmExDays.get(linkedCustomerId) as number[]) : null,
        address: t.indirizzo || '',
        city: t.comune || '',
        province: t.provincia || '',
        lat,
        lng,
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
        orphanStatus: status,
        estimatedRevenue: null,
        score: 0,
        priorityClass: 'Bassa',
        reason: '',
        nextSuggestedVisit: null,
        visitMinutes: settings.visit_minutes_orphan,
        potentialValue: 0,
      });
    }
  }

  const orphanCustomerIds = new Set(orphans.filter((o) => o.customerId).map((o) => o.customerId));
  const orphanTabIds = new Set(orphans.filter((o) => o.tabaccheriaId).map((o) => o.tabaccheriaId));
  // Un punto vendita = UN candidato: chi è già tra gli orfani non deve rientrare
  // come cliente/prospect (stesso customer o stessa tabaccheria collegata)
  const notInOrphans = (r: CustomerRow) =>
    !orphanCustomerIds.has(r.id) && !(r.tabaccheria_id && orphanTabIds.has(r.tabaccheria_id));
  return {
    clients: clientRows
      .filter(notInOrphans)
      .map((r) => toCandidate(r, 'client', stats.get(r.id), appointments.get(r.id) || null, settings, null, projects, remoteOrders.get(r.id), learnedDurations.get(r.id), slotDefs))
      .filter((c) => !isNoInterestBlocked(c, noBlock)),
    prospects: prospectRows
      .filter(notInOrphans)
      .map((r) => toCandidate(r, 'prospect', stats.get(r.id), appointments.get(r.id) || null, settings, null, projects, undefined, learnedDurations.get(r.id), slotDefs))
      .filter((c) => !isNoInterestBlocked(c, noBlock)),
    orphans: orphans.filter((c) => !isNoInterestBlocked(c, noBlock)),
  };
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface FreeTabFilters {
  provincia?: string;
  comune?: string;
  refLat?: number;
  refLng?: number;
  agentId?: string;
}

// Tabaccherie mai visitate nell'area del giro: libere (non assegnate) = "Da acquisire"
// + quelle del territorio dell'agente senza scheda cliente = "Mai visitata".
export async function loadFreeTabaccherie(
  bounds: GeoBounds,
  excludeTabIds: Set<string>,
  settings: AiTourSettings,
  filters: FreeTabFilters = {},
  limit = 60,
  throwOnError = false,
  options: { allowLimit?: boolean; onLimitReached?: () => void } = {},
): Promise<TourCandidate[]> {
  // Web a57b8e3e: PostgREST limita ogni risposta a 1000, anche con p_limit maggiore.
  const PAGE = 1000, data: unknown[] = [];
  let error: unknown = null;
  for (let from = 0; from < limit; from += PAGE) {
    const to = Math.min(from + PAGE, limit) - 1;
    const page = await supabase.rpc('ai_tour_free_tabaccherie', {
      p_min_lat: bounds.minLat, p_max_lat: bounds.maxLat,
      p_min_lng: bounds.minLng, p_max_lng: bounds.maxLng,
      p_limit: limit,
      p_provincia: filters.provincia || null, p_comune: filters.comune || null,
      p_ref_lat: filters.refLat ?? null, p_ref_lng: filters.refLng ?? null,
      p_agent_id: filters.agentId || null,
    }).range(from, to);
    if (page.error) { error = page.error; break; }
    const rows = (page.data || []) as unknown[];
    data.push(...rows);
    if (rows.length < to - from + 1) break;
  }
  if (error) {
    console.warn('[AITour][data] ai_tour_free_tabaccherie:', error);
    if (throwOnError) throw new Error('Ricerca nel registro tabaccherie non disponibile: riprova. Non è un risultato senza soggetti.');
    return [];
  }
  if (data.length >= limit) {
    options.onLimitReached?.();
    if (throwOnError && !options.allowLimit) throw new Error('Area di sviluppo troppo ampia per una ricerca completa: riduci raggio o corridoio e riprova');
  }
  const noBlock = await getNoInterestBlock();
  const out: TourCandidate[] = [];
  for (const t of (data || []) as { id: string; denominazione: string | null; codice_rivendita: string | null; indirizzo: string | null; comune: string | null; provincia: string | null; lat: number; lng: number; assigned: boolean | null }[]) {
    if (excludeTabIds.has(t.id)) continue;
    if (noBlock.tabs.has(t.id)) continue; // "non interessato" < 6 mesi: non riproporre
    const lat = Number(t.lat);
    const lng = Number(t.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const entityType: EntityType = t.assigned ? 'never' : 'free';
    out.push({
      key: `${entityType}:${t.id}`,
      entityType,
      customerId: null,
      tabaccheriaId: t.id,
      name: t.denominazione || `Tabaccheria Riv. ${t.codice_rivendita || ''}`.trim(),
      address: t.indirizzo || '',
      city: t.comune || '',
      province: t.provincia || '',
      lat,
      lng,
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
      score: 0,
      priorityClass: 'Bassa',
      reason: '',
      nextSuggestedVisit: null,
      visitMinutes: settings.visit_minutes_prospect,
      potentialValue: 0,
    });
  }
  return out;
}
