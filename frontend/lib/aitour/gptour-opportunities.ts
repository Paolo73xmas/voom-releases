import { getMatrix } from './osrm';
import type { TourCandidate, TourPlan, AiTourSettings } from './types';
import { haversineKm } from './types';
import type { TourIntent } from './gptour-intent';
import { candidateMatchesTourIntent } from './gptour-criteria';
import { IdentitySet } from './gptour-identity';
import { bordersOf, comuneGeoTier } from './comuni-adjacency';

type Matrix = (number | null)[][];
const value = (m: Matrix, a: number, b: number): number => m[a]?.[b] ?? 999999;
export function pathCost(m: Matrix, seq: number[]): number { return seq.slice(1).reduce((s, b, i) => s + value(m, seq[i], b), 0); }
export function bestInsertion(m: Matrix, seq: number[], candidate: number, openEnd = false): { cost: number; pos: number } {
  if (seq.length < 2) return { cost: seq.length ? value(m, seq[0], candidate) : 0, pos: seq.length };
  let best = { cost: Infinity, pos: 1 };
  for (let j = 1; j < seq.length; j++) {
    const cost = value(m, seq[j - 1], candidate) + value(m, candidate, seq[j]) - value(m, seq[j - 1], seq[j]);
    if (cost < best.cost) best = { cost, pos: j };
  }
  if (openEnd && value(m, seq[seq.length - 1], candidate) < best.cost) return { cost: value(m, seq[seq.length - 1], candidate), pos: seq.length };
  return best;
}
export function combinedDeviation(m: Matrix, initial: number[], candidates: number[], openEnd = false) {
  const seq = [...initial];
  for (const c of candidates) { const insert = bestInsertion(m, seq, c, openEnd); seq.splice(insert.pos, 0, c); }
  return { total: Math.max(0, pathCost(m, seq) - pathCost(m, initial)), seq };
}
export function routeDistanceKm(c: TourCandidate, geometry: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < geometry.length; i++) {
    const [aLat, aLng] = geometry[i - 1], [bLat, bLng] = geometry[i];
    const scale = Math.cos(c.lat * Math.PI / 180), dx = (bLng - aLng) * scale, dy = bLat - aLat;
    const f = Math.max(0, Math.min(1, (((c.lng - aLng) * scale) * dx + (c.lat - aLat) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, haversineKm(c.lat, c.lng, aLat + f * (bLat - aLat), aLng + f * (bLng - aLng)));
  }
  return best;
}
export interface GptProposal { candidates: TourCandidate[]; orderedKeys: string[]; extraMinutes: number; extraKm: number; warning?: string }
export async function proposeGptour(plan: TourPlan, allPlans: TourPlan[], pool: TourCandidate[], intent: TourIntent,
  settings: AiTourSettings, corridor = false, matrixFn: typeof getMatrix = (points) => getMatrix(points, true)): Promise<GptProposal> {
  const empty = (warning?: string): GptProposal => ({ candidates: [], orderedKeys: [], extraMinutes: 0, extraKm: 0, warning });
  if (intent.allowLargeBuffer || (!corridor && plan.bufferMin <= (settings.max_daily_buffer_minutes ?? 120))) return empty();
  if (plan.routingFallback) return empty('Integrazioni sospese: percorso stradale non verificato.');
  const identities = IdentitySet.from(allPlans.flatMap((p) => p.stops.map((s) => s.candidate)));
  const city = intent.requestedArea?.comune || plan.stops[0]?.candidate.city || '', borders = bordersOf(city);
  const route = [plan.start, ...plan.stops.map((s) => s.candidate), ...(plan.end ? [plan.end] : [])];
  const typeRank = (c: TourCandidate) => intent.requestedEntityTypes.includes(c.entityType) ? 0 : c.entityType === 'prospect' ? 1 : c.entityType === 'free' || c.entityType === 'never' ? 2 : 3;
  const offered = pool.filter((c) => !identities.has(c) && candidateMatchesTourIntent(c, intent, corridor ? 'corridor' : 'fill') && (!corridor || routeDistanceKm(c, plan.geometry) <= 5))
    .sort((a, b) => typeRank(a) - typeRank(b) || comuneGeoTier(a.city, city, borders) - comuneGeoTier(b.city, city, borders) || routeDistanceKm(a, plan.geometry) - routeDistanceKm(b, plan.geometry))
    .slice(0, Math.max(0, Math.min(25, 95 - route.length)));
  if (!offered.length) return empty();
  const matrix = await matrixFn([...route, ...offered]);
  if (matrix.fallback) return empty('Integrazioni sospese: costo marginale stradale non verificato.');
  const initial = route.map((_, i) => i), offsets = offered.map((_, i) => i + route.length);
  offsets.sort((a, b) => typeRank(offered[a - route.length]) - typeRank(offered[b - route.length]) || comuneGeoTier(offered[a - route.length].city, city, borders) - comuneGeoTier(offered[b - route.length].city, city, borders) || bestInsertion(matrix.durations, initial, a, !plan.end).cost - bestInsertion(matrix.durations, initial, b, !plan.end).cost);
  const chosen: number[] = []; let visit = 0;
  for (const index of offsets) {
    const duration = visit + offered[index - route.length].visitMinutes;
    const delta = combinedDeviation(matrix.durations, initial, [...chosen, index], !plan.end);
    if (plan.finishMin + delta.total / 60 + duration > plan.endMin) continue;
    chosen.push(index); visit = duration;
    if (chosen.length >= 8 || plan.endMin - (plan.finishMin + delta.total / 60 + visit) <= (settings.max_daily_buffer_minutes ?? 120)) break;
  }
  const combined = combinedDeviation(matrix.durations, initial, chosen, !plan.end);
  const keyAt = (index: number) => index >= route.length ? offered[index - route.length].key : index > 0 && index <= plan.stops.length ? plan.stops[index - 1].candidate.key : null;
  return { candidates: chosen.map((i) => offered[i - route.length]), orderedKeys: combined.seq.map(keyAt).filter((s): s is string => !!s),
    extraMinutes: combined.total / 60, extraKm: Math.max(0, pathCost(matrix.distances, combined.seq) - pathCost(matrix.distances, initial)) / 1000 };
}