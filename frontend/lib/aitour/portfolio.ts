// Tab "Portafoglio" dell'AI Tour (parità web commit 12d0f51): attività recente
// dei clienti dell'agente e potenziali punti vendita nelle zone assegnate.
import { supabase } from '../supabase';
import { loadCandidates, loadFreeTabaccherie } from './data';
import { pointInZones, zoneLabel, type TerritoryZone } from './territories';
import type { AiTourSettings, TourCandidate } from './types';

export interface VisitBrief {
  date: string;
  type: string;
  outcome: string | null;
  notes: string | null;
}

export interface CustomerActivityRow {
  customerId: string;
  name: string;
  city: string;
  address: string;
  lastVisits: VisitBrief[];
  lastVisitDate: string | null;
  lastOrderDate: string | null;
  lastInspectionDate: string | null;
  /** Ultimo passaggio con ordine o ispezione (la data più recente tra i due) */
  lastPassageDate: string | null;
  daysSincePassage: number | null;
}

const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

export async function loadCustomerActivity(agentId: string): Promise<CustomerActivityRow[]> {
  const [custRes, visRes, ordRes, inspRes] = await Promise.all([
    supabase.from('customers').select('id, business_name, city, address').eq('agent_id', agentId).order('business_name').limit(3000),
    supabase.from('visits').select('customer_id, visit_date, visit_type, outcome, notes').eq('agent_id', agentId).order('visit_date', { ascending: false }).limit(6000),
    supabase.from('orders').select('customer_id, order_date').eq('agent_id', agentId).eq('is_deleted', false).order('order_date', { ascending: false }).limit(9000),
    supabase.from('inspections').select('customer_id, created_at').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(6000),
  ]);
  if (custRes.error) throw custRes.error;

  const visitsBy = new Map<string, VisitBrief[]>();
  for (const v of (visRes.data || []) as { customer_id: string; visit_date: string; visit_type: string; outcome: string | null; notes: string | null }[]) {
    const list = visitsBy.get(v.customer_id) || [];
    if (list.length < 3) {
      list.push({ date: v.visit_date, type: v.visit_type, outcome: v.outcome, notes: v.notes });
      visitsBy.set(v.customer_id, list);
    }
  }
  const lastOrderBy = new Map<string, string>();
  for (const o of (ordRes.data || []) as { customer_id: string; order_date: string }[]) {
    if (o.customer_id && !lastOrderBy.has(o.customer_id)) lastOrderBy.set(o.customer_id, o.order_date);
  }
  const lastInspBy = new Map<string, string>();
  for (const i of (inspRes.data || []) as { customer_id: string; created_at: string }[]) {
    if (i.customer_id && !lastInspBy.has(i.customer_id)) lastInspBy.set(i.customer_id, i.created_at);
  }

  return ((custRes.data || []) as { id: string; business_name: string; city: string | null; address: string | null }[]).map((c) => {
    const lastVisits = visitsBy.get(c.id) || [];
    const lastOrderDate = lastOrderBy.get(c.id) || null;
    const lastInspectionDate = lastInspBy.get(c.id) || null;
    const lastPassageDate = [lastOrderDate, lastInspectionDate].filter(Boolean).sort().pop() || null;
    return {
      customerId: c.id,
      name: c.business_name,
      city: c.city || '',
      address: c.address || '',
      lastVisits,
      lastVisitDate: lastVisits[0]?.date || null,
      lastOrderDate,
      lastInspectionDate,
      lastPassageDate,
      daysSincePassage: daysSince(lastPassageDate),
    };
  });
}

export interface PotentialRow {
  key: string;
  name: string;
  city: string;
  address: string;
  zone: string;
  stato: 'libera' | 'prospect' | 'orfano';
  lastVisitDate: string | null;
}

export async function loadZonePotentials(agentId: string, settings: AiTourSettings, zones: TerritoryZone[]): Promise<PotentialRow[]> {
  if (zones.length === 0) return [];
  const pool = await loadCandidates(agentId, settings);
  const inZone = (c: TourCandidate) => pointInZones(c.lat, c.lng, zones);
  const zoneOf = (c: TourCandidate) => {
    const z = zones.find((zz) => pointInZones(c.lat, c.lng, [zz]));
    return z ? zoneLabel(z) : '';
  };
  const rows: PotentialRow[] = [];
  for (const p of pool.prospects.filter(inZone)) {
    rows.push({ key: p.key, name: p.name, city: p.city, address: p.address, zone: zoneOf(p), stato: 'prospect', lastVisitDate: p.lastVisitDate });
  }
  for (const o of pool.orphans.filter(inZone)) {
    rows.push({ key: o.key, name: o.name, city: o.city, address: o.address, zone: zoneOf(o), stato: 'orfano', lastVisitDate: o.lastVisitDate });
  }
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const z of zones) for (const [lng, lat] of z.geometry.coordinates[0] as [number, number][]) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  const exclude = new Set<string>([...pool.clients, ...pool.prospects, ...pool.orphans].map((c) => c.tabaccheriaId).filter((x): x is string => !!x));
  const free = await loadFreeTabaccherie({ minLat, maxLat, minLng, maxLng }, exclude, settings, { refLat: (minLat + maxLat) / 2, refLng: (minLng + maxLng) / 2, agentId }, 500);
  const seen = new Set(rows.map((r) => r.key));
  for (const f of free.filter(inZone)) {
    if (seen.has(f.key)) continue;
    rows.push({ key: f.key, name: f.name, city: f.city, address: f.address, zone: zoneOf(f), stato: 'libera', lastVisitDate: f.lastVisitDate });
  }
  return rows.sort((a, b) => a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name));
}
