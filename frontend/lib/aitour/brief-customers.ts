import Fuse from 'fuse.js';
import { supabase } from '../supabase';
import { normalizeLocality } from './brief-area';

export interface BriefCustomer { id: string; name: string; crmName?: string; contactName?: string; resaleCode?: string; city: string; province: string; address: string; lat: number; lng: number }
export const validCustomerPoint = (c: Pick<BriefCustomer, 'lat' | 'lng'>) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 && !(c.lat === 0 && c.lng === 0);
// Identità clienti risolte SOLO sul dispositivo; mai inviate al modello.
export async function loadBriefCustomers(agentId: string): Promise<BriefCustomer[]> {
  if (!agentId) throw new Error('Sessione agente non disponibile');
  const out: BriefCustomer[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('customers')
      .select('id,business_name,contact_name,contact_surname,city,province,address,latitude,longitude,tabaccherie!customers_tabaccheria_id_fkey(denominazione,codice_rivendita)')
      .eq('agent_id', agentId).eq('disabled', false).order('id').range(offset, offset + 499);
    if (error) throw new Error('Impossibile verificare il portafoglio clienti. Riprova.');
    for (const r of data || []) {
      const tab = Array.isArray(r.tabaccherie) ? r.tabaccherie[0] : r.tabaccherie;
      out.push({ id: r.id, name: r.business_name || '', crmName: tab?.denominazione || '', contactName: [r.contact_name, r.contact_surname].filter(Boolean).join(' '),
        resaleCode: String(tab?.codice_rivendita || ''), city: r.city || '', province: r.province || '', address: r.address || '',
        lat: r.latitude == null ? NaN : Number(r.latitude), lng: r.longitude == null ? NaN : Number(r.longitude) });
    }
    if (!data || data.length < 500) break;
  }
  return out;
}
const STOPWORDS = new Set(['di', 'da', 'del', 'della', 'il', 'la', 'lo', 'le', 'quello', 'quella', 'tabaccheria', 'tabacchi', 'bar', 'edicola', 'rivendita', 'signor', 'sig']);
const words = (s: string) => normalizeLocality(s).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t));
export function matchBriefCustomers(ref: { rawReference: string; cityHint?: string | null }, customers: BriefCustomer[]): { status: 'resolved' | 'ambiguous' | 'unresolved'; options: BriefCustomer[] } {
  const cityWords = new Set(words(ref.cityHint || ''));
  const q = words(ref.rawReference).filter((w) => !cityWords.has(w)).join(' ');
  const unique = [...new Map(customers.map((c, i) => [c.id || `missing-id:${i}`, c])).values()];
  const fuse = new Fuse(unique, { includeScore: true, ignoreLocation: true, threshold: 0.38,
    keys: [{ name: 'name', weight: 0.4 }, { name: 'crmName', weight: 0.25 }, { name: 'contactName', weight: 0.2 }, { name: 'resaleCode', weight: 0.1 }, { name: 'address', weight: 0.05 }],
    getFn: (obj, path) => words(String(obj[(Array.isArray(path) ? path[0] : path) as keyof BriefCustomer] || '')).join(' ') });
  const hits = q ? fuse.search(q).map((h) => ({ c: h.item, score: h.score ?? 1 })) : unique.filter((c) => !!ref.cityHint && normalizeLocality(c.city) === normalizeLocality(ref.cityHint)).map((c) => ({ c, score: 0.5 }));
  const ranked = hits.map((h) => ({ ...h, score: h.score + (ref.cityHint && normalizeLocality(h.c.city) !== normalizeLocality(ref.cityHint) ? 0.35 : 0) })).sort((a, b) => a.score - b.score);
  if (!ranked.length) return { status: 'unresolved', options: [] };
  const best = ranked[0];
  const strong = !!q && !!best.c.id && best.score < 0.25 && (!ranked[1] || ranked[1].score - best.score >= 0.12);
  return { status: strong ? 'resolved' : 'ambiguous', options: ranked.slice(0, 6).map((h) => h.c) };
}