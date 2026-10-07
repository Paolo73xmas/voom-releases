import type { TourCandidate } from './types';
export const normalizeGptourName = (v: unknown): string => String(v ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function identityTokensOf(c: TourCandidate): string[] {
  const out = [`k:${c.key}`];
  if (c.customerId) out.push(`c:${c.customerId}`);
  if (c.tabaccheriaId) out.push(`t:${c.tabaccheriaId}`);
  const n = normalizeGptourName(c.crmName || c.name);
  if (n && Number.isFinite(c.lat) && Number.isFinite(c.lng)) out.push(`p:${c.lat.toFixed(5)}|${c.lng.toFixed(5)}|${n}`);
  return out;
}
export class IdentitySet {
  private seen = new Set<string>();
  has(c: TourCandidate): boolean { return identityTokensOf(c).some((t) => this.seen.has(t)); }
  add(c: TourCandidate): void { identityTokensOf(c).forEach((t) => this.seen.add(t)); }
  static from(list: TourCandidate[]): IdentitySet { const s = new IdentitySet(); list.forEach((c) => s.add(c)); return s; }
  static fromKeys(pool: TourCandidate[], keys: Iterable<string>): IdentitySet {
    const byKey = new Map(pool.map((c) => [c.key, c])), s = new IdentitySet();
    for (const k of keys) { const c = byKey.get(k); if (c) s.add(c); }
    return s;
  }
}
export function dedupeGptour(list: TourCandidate[]): TourCandidate[] {
  const set = new IdentitySet(); return list.filter((c) => { if (set.has(c)) return false; set.add(c); return true; });
}