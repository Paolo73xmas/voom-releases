// Caricamento candidati AI Tour: clienti, prospect (customers dell'agente) + orfani (RPC + tabaccherie).
import { supabase } from '../supabase';
import { getOrphanConfig, fetchOrphanMap } from '../api/orphan-claims';
import type { TourCandidate, EntityType, AiTourSettings } from './types';
import { daysSince } from './types';

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
}

// Progetti Speciali: slug -> nome visualizzato
async function fetchProjectsMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase.from('projects').select('slug, name').eq('is_active', true);
  if (error) {
    console.warn('[AITour][data] projects:', error);
    return map;
  }
  for (const p of data || []) if (p.slug && p.slug !== 'nessun_progetto') map.set(p.slug, p.name || p.slug);
  return map;
}

async function fetchOrderStats(customerIds: string[]): Promise<Map<string, OrderStats>> {
  const map = new Map<string, OrderStats>();
  for (let i = 0; i < customerIds.length; i += 200) {
    const batch = customerIds.slice(i, i + 200);
    const { data, error } = await supabase.rpc('ai_tour_order_stats', { p_customer_ids: batch });
    if (error) {
      console.error('[AITour][data] ai_tour_order_stats:', error);
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
    potentialValue: 0,
  };
}

export interface CandidatePool {
  clients: TourCandidate[];
  prospects: TourCandidate[];
  orphans: TourCandidate[];
}

export async function loadCandidates(agentId: string, settings: AiTourSettings): Promise<CandidatePool> {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, business_name, category, address, city, province, latitude, longitude, last_visit_date, last_order_date, notes, estimated_revenue, tabaccheria_id, project_type')
    .eq('agent_id', agentId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  if (error) throw error;

  const rows = ((customers || []) as CustomerRow[]).filter(
    (r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
  );
  const clientRows = rows.filter((r) => r.category === 'client');
  const prospectRows = rows.filter((r) => r.category === 'prospect' || r.category === 'lead');

  const [stats, appointments, orphanConfig, projects, remoteOrders, learnedDurations] = await Promise.all([
    fetchOrderStats(clientRows.map((r) => r.id)),
    fetchUpcomingAppointments(agentId),
    getOrphanConfig(),
    fetchProjectsMap(),
    fetchLastRemoteOrders(agentId),
    fetchLearnedDurations(agentId),
  ]);
  const orphanMap = await fetchOrphanMap(orphanConfig);

  // Orfani propri (clienti dell'agente diventati orfani) - dati completi
  const ownOrphanKeys = new Set<string>();
  const orphans: TourCandidate[] = [];
  for (const r of clientRows) {
    const status = r.tabaccheria_id ? orphanMap.get(r.tabaccheria_id) : undefined;
    if (status) {
      orphans.push(toCandidate(r, 'orphan', stats.get(r.id), appointments.get(r.id) || null, settings, status, projects, remoteOrders.get(r.id), learnedDurations.get(r.id)));
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
      .not('gps_lat', 'is', null)
      .not('gps_lng', 'is', null);
    if (tabErr) {
      console.warn('[AITour][data] tabaccherie orfane:', tabErr);
      continue;
    }
    for (const t of tabs || []) {
      const status = orphanMap.get(t.id) || null;
      const lat = Number(t.gps_lat);
      const lng = Number(t.gps_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      orphans.push({
        key: `orphan:${t.id}`,
        entityType: 'orphan',
        customerId: null,
        // Cliente di altro agente (invisibile via RLS): id usato SOLO per lo
        // storico ordini del badge Orfano (RPC SECURITY DEFINER a dato minimo)
        historyCustomerId: t.customer_id || null,
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
  return {
    clients: clientRows
      .filter((r) => !orphanCustomerIds.has(r.id))
      .map((r) => toCandidate(r, 'client', stats.get(r.id), appointments.get(r.id) || null, settings, null, projects, remoteOrders.get(r.id), learnedDurations.get(r.id))),
    prospects: prospectRows.map((r) => toCandidate(r, 'prospect', stats.get(r.id), appointments.get(r.id) || null, settings, null, projects, undefined, learnedDurations.get(r.id))),
    orphans,
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
): Promise<TourCandidate[]> {
  const { data, error } = await supabase.rpc('ai_tour_free_tabaccherie', {
    p_min_lat: bounds.minLat,
    p_max_lat: bounds.maxLat,
    p_min_lng: bounds.minLng,
    p_max_lng: bounds.maxLng,
    p_limit: limit,
    p_provincia: filters.provincia || null,
    p_comune: filters.comune || null,
    p_ref_lat: filters.refLat ?? null,
    p_ref_lng: filters.refLng ?? null,
    p_agent_id: filters.agentId || null,
  });
  if (error) {
    console.warn('[AITour][data] ai_tour_free_tabaccherie:', error);
    return [];
  }
  const out: TourCandidate[] = [];
  for (const t of (data || []) as { id: string; denominazione: string | null; codice_rivendita: string | null; indirizzo: string | null; comune: string | null; provincia: string | null; lat: number; lng: number; assigned: boolean | null }[]) {
    if (excludeTabIds.has(t.id)) continue;
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
