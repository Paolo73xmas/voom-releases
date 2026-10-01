import { supabase } from '../supabase';
import { loadCandidates, loadFreeTabaccherie } from './data';
import { listAllZones, pointInZones, zoneLabel, type TerritoryZone } from './territories';
import { scoreCandidates } from './scoring';
import { daysSince, type AiTourSettings, type TourCandidate } from './types';
import { dedupeGptour } from './gptour-identity';

export interface GptPool { candidates: TourCandidate[]; authorizedCandidates: TourCandidate[]; zones: TerritoryZone[]; complete: boolean; warnings: string[] }
export function physicalContact(visit: string | null, inspection: string | null): string | null {
  return [visit, inspection].filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}
export function isVisibleInAgentZones(c: TourCandidate, zones: TerritoryZone[]): boolean {
  return !zones.length || c.isOwnOrphan === true || (!!c.projectType && c.projectType !== 'nessun_progetto') || pointInZones(c.lat, c.lng, zones);
}
export async function loadGptourPool(agentId: string, settings: AiTourSettings): Promise<GptPool> {
  const [loaded, allZones] = await Promise.all([loadCandidates(agentId, settings, true), listAllZones()]);
  const zones = allZones.filter((z) => z.agent_id === agentId), warnings: string[] = [];
  if (allZones.length >= 1000) warnings.push('Elenco territori al limite di lettura: copertura territoriale da verificare.');
  const base = [...loaded.clients, ...loaded.prospects, ...loaded.orphans];
  const ids = [...new Set(base.map((c) => c.customerId).filter((v): v is string => !!v))];
  const contacts = new Map<string, { last_visit_date: string | null; last_inspection_date: string | null }>();
  const orders = new Map<string, { last_order_date: string | null; revenue_6m: number }>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    const [contact, order] = await Promise.all([
      supabase.rpc('ai_tour_contact_stats', { p_customer_ids: batch }),
      supabase.rpc('ai_tour_order_stats', { p_customer_ids: batch }),
    ]);
    if (contact.error) warnings.push('Statistiche visita/ispezione non disponibili per una parte del portafoglio.');
    else for (const row of contact.data || []) contacts.set(row.customer_id, row);
    if (order.error) warnings.push('Statistiche ordini non disponibili per una parte del portafoglio.');
    else for (const row of order.data || []) orders.set(row.customer_id, row);
  }
  for (const c of base) {
    const contact = c.customerId ? contacts.get(c.customerId) : undefined;
    const order = c.customerId ? orders.get(c.customerId) : undefined;
    c.lastInspectionDate = contact?.last_inspection_date ?? null;
    c.lastVisitDate = physicalContact(c.lastVisitDate, contact?.last_visit_date ?? null);
    c.lastPhysicalContactDate = physicalContact(c.lastVisitDate, c.lastInspectionDate);
    c.daysSincePhysicalContact = daysSince(c.lastPhysicalContactDate);
    if (order) { c.lastOrderDate = order.last_order_date; c.daysSinceOrder = daysSince(c.lastOrderDate); c.revenue6m = Number(order.revenue_6m); }
    c.gptourData = { contactKnown: !!contact, orderKnown: !!order, revenueKnown: !!order && Number.isFinite(Number(order.revenue_6m)),
      zoneNames: zones.filter((z) => pointInZones(c.lat, c.lng, [z])).flatMap((z) => [z.zone_name, zoneLabel(z)]) };
  }
  const points = zones.length ? zones.flatMap((z) => z.geometry.coordinates.flat().map(([lng, lat]) => ({ lat, lng }))) : base;
  let free: TourCandidate[] = [];
  if (points.length) {
    const bounds = { minLat: Math.min(...points.map((p) => p.lat)) - .1, maxLat: Math.max(...points.map((p) => p.lat)) + .1,
      minLng: Math.min(...points.map((p) => p.lng)) - .1, maxLng: Math.max(...points.map((p) => p.lng)) + .1 };
    try {
      free = await loadFreeTabaccherie(bounds, new Set(base.map((c) => c.tabaccheriaId).filter((s): s is string => !!s)), settings, { agentId }, 2500, true);
    } catch (e) { warnings.push(e instanceof Error ? e.message : 'Registro parziale.'); }
  } else warnings.push('Area operativa non disponibile: registro non caricato.');
  free.forEach((c) => { c.daysSincePhysicalContact = null; c.lastInspectionDate = null; c.lastPhysicalContactDate = null;
    c.gptourData = { contactKnown: true, orderKnown: true, revenueKnown: true, zoneNames: zones.filter((z) => pointInZones(c.lat, c.lng, [z])).flatMap((z) => [z.zone_name, zoneLabel(z)]) }; });
  const candidates = dedupeGptour([...base, ...free].filter((c) => isVisibleInAgentZones(c, zones)));
  scoreCandidates(candidates, settings);
  if (base.some((c) => !c.gptourData?.contactKnown || !c.gptourData?.orderKnown)) warnings.push('Alcuni soggetti hanno storico non verificato: non vengono trattati come mai contattati.');
  return { candidates, authorizedCandidates: base, zones, complete: warnings.length === 0, warnings: [...new Set(warnings)] };
}