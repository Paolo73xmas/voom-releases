// Porting del modulo web @ a57b8e3e: cambiano solo i percorsi/tipi degli import.
import type { TourCandidate, AiTourSettings, EntityType } from './types';
import type { TourIntent } from './gptour-intent';
import type { GptResult } from './gptour-api';
import { filterPoolByIntent, requestedComuniNorm } from './gptour-criteria';
import { estimateDayCapacity, MAX_DAY_RADIUS_KM } from './gptour-capacity';
import { IdentitySet } from './gptour-identity';
import { bordersOf, normalizeComune } from './comuni-adjacency';

type GptSelectionItem = GptResult['selection'][number];
export const DEVELOPMENT_TYPES: EntityType[] = ['free', 'never'];
const DEV_RE = /\bsvilupp\w*|\bacquisi\w*|nuov[io] punt[io]|punt[io] (vendita )?nuov[io]|tabaccheri[ae] nuov[ae]|nuov[ae] tabaccheri[ae]|client[ei] nuov[io]|nuov[io] client[ei]|mai visitat\w*|mai acquistat\w*/i;
const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function isDevelopmentRequest(text: string): boolean {
  return DEV_RE.test(norm(text || ''));
}
export function applyDevelopmentIntent(intent: TourIntent, userText: string): TourIntent {
  if (!isDevelopmentRequest(userText)) return intent;
  if (DEVELOPMENT_TYPES.every((t) => intent.requestedEntityTypes.includes(t))) return intent;
  return { ...intent, requestedEntityTypes: [...new Set([...intent.requestedEntityTypes, ...DEVELOPMENT_TYPES])] };
}
export const isDevelopmentIntent = (intent: TourIntent): boolean =>
  DEVELOPMENT_TYPES.every((t) => intent.requestedEntityTypes.includes(t));

export function inferTourDate(text: string, today: string): string {
  const t = norm(text || '');
  const add = /dopodomani/.test(t) ? 2 : /\bdomani/.test(t) ? 1 : 0;
  if (add === 0) return today;
  const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
export function emptyDevelopmentResult(res: GptResult, tourDate: string): GptResult {
  return { ...res, needsInfo: false, multiDay: false, selection: [], days: [], tourDate: res.tourDate || tourDate };
}
const hav = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371, p = Math.PI / 180, dLat = (bLat - aLat) * p, dLng = (bLng - aLng) * p;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
export async function developmentBorders(intent: TourIntent): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of intent.requestedArea?.comuni ?? []) {
    try { for (const b of await bordersOf(c)) out.add(b); } catch { /* solo comuni richiesti se adiacenze indisponibili */ }
  }
  return out;
}
export interface DevelopmentCompletion { result: GptResult; added: number; comuni: string[] }

/** Comuni richiesti prima dei confinanti; senza area, entro 45 km. Mai rimuovere le tappe AI. */
export function completeDevelopmentDay(
  result: GptResult, pool: TourCandidate[], intent: TourIntent, settings: AiTourSettings,
  borderSet: Set<string>, anchor: { lat: number; lng: number },
): DevelopmentCompletion {
  if (!isDevelopmentIntent(intent) || result.needsInfo || result.multiDay) return { result, added: 0, comuni: [] };
  const capacity = estimateDayCapacity(settings, settings.visit_minutes_prospect);
  const room = capacity - result.selection.length;
  if (room <= 0) return { result, added: 0, comuni: [] };
  const selectedKeys = result.selection.map((s) => s.key);
  const present = IdentitySet.fromKeys(pool, selectedKeys);
  const comuni = requestedComuniNorm(intent.requestedArea);
  const tierOf = (c: TourCandidate): number => {
    if (comuni.size === 0) return 0;
    const n = normalizeComune(c.city);
    return comuni.has(n) ? 0 : borderSet.has(n) ? 1 : 2;
  };
  const eligible = filterPoolByIntent(pool, intent, 'corridor', new Set(selectedKeys))
    .filter((c) => DEVELOPMENT_TYPES.includes(c.entityType) && c.lat && c.lng && !present.has(c))
    .map((c) => ({ c, tier: tierOf(c) }))
    .filter((x) => x.tier <= 1);
  if (eligible.length === 0) return { result, added: 0, comuni: [] };
  const byKey = new Map(pool.map((c) => [c.key, c]));
  const chosen = selectedKeys.map((k) => byKey.get(k)).filter((c): c is TourCandidate => !!c && !!c.lat);
  const seedPts = chosen.length ? chosen : eligible.filter((x) => x.tier === 0).map((x) => x.c);
  let center = seedPts.length
    ? { lat: seedPts.reduce((s, c) => s + c.lat, 0) / seedPts.length, lng: seedPts.reduce((s, c) => s + c.lng, 0) / seedPts.length }
    : anchor;
  const nearEnough = eligible.filter((x) => comuni.size > 0 || hav(center.lat, center.lng, x.c.lat, x.c.lng) <= MAX_DAY_RADIUS_KM);
  const added: GptSelectionItem[] = [];
  const remaining = [...nearEnough];
  let n = chosen.length;
  while (added.length < room && remaining.length) {
    remaining.sort((a, b) => a.tier - b.tier || hav(center.lat, center.lng, a.c.lat, a.c.lng) - hav(center.lat, center.lng, b.c.lat, b.c.lng));
    const pick = remaining.shift()!;
    if (present.has(pick.c)) continue;
    present.add(pick.c);
    added.push({ key: pick.c.key, reason: 'Nuovo punto vendita (sviluppo, completamento deterministico)' });
    center = { lat: (center.lat * n + pick.c.lat) / (n + 1), lng: (center.lng * n + pick.c.lng) / (n + 1) };
    n++;
  }
  if (added.length === 0) return { result, added: 0, comuni: [] };
  const comuniAdded = [...new Set(added.map((a) => byKey.get(a.key)?.city || '').filter(Boolean))];
  return { result: { ...result, needsInfo: false, selection: [...result.selection, ...added] }, added: added.length, comuni: comuniAdded };
}