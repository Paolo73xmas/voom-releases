import { getMatrix, getRoute, type OsrmMatrix } from './osrm';
import { VISIT_SLOT_TOLERANCE_MIN } from '../visit-slots';
import type { TourCandidate, GeoPoint, TourPlan, AiTourSettings } from './types';
import { timeToMin } from './types';
import { isoDow } from './gptour-dates';
export function windowArrival(c: TourCandidate, raw: number): { arrival: number; outside: boolean } {
  if (!c.preferredSlots?.length) return { arrival: raw, outside: false };
  const possible = c.preferredSlots.map((s) => ({ start: s.start - (s.strict ? 0 : VISIT_SLOT_TOLERANCE_MIN), end: s.end + (s.strict ? 0 : VISIT_SLOT_TOLERANCE_MIN) }))
    .filter((s) => raw <= s.end).map((s) => Math.max(raw, s.start));
  return { arrival: possible.length ? Math.min(...possible) : raw, outside: !possible.length };
}
const distance = (m: OsrmMatrix, a: number, b: number) => m.durations[a]?.[b] ?? 999999;
export function optimizeIndices(candidates: TourCandidate[], m: OsrmMatrix, startMin: number, hasEnd: boolean): number[] {
  const cost = (order: number[]) => {
    let t = startMin, prev = 0, penalties = 0;
    for (const k of order) { const raw = t + distance(m, prev, k + 1) / 60; const w = windowArrival(candidates[k], raw); penalties += w.outside ? 10000 : 0; t = w.arrival + candidates[k].visitMinutes; prev = k + 1; }
    return t + penalties + (hasEnd ? distance(m, prev, candidates.length + 1) / 60 : 0);
  };
  const left = candidates.map((_, i) => i), nearest: number[] = []; let prev = 0;
  while (left.length) { left.sort((a, b) => distance(m, prev, a + 1) - distance(m, prev, b + 1)); const k = left.shift()!; nearest.push(k); prev = k + 1; }
  const byWindow = candidates.map((_, i) => i).sort((a, b) => (candidates[a].preferredSlots?.[0]?.start ?? startMin) - (candidates[b].preferredSlots?.[0]?.start ?? startMin));
  let best = cost(byWindow) < cost(nearest) ? byWindow : nearest;
  for (let pass = 0; pass < 5; pass++) {
    let improved = false;
    for (let i = 0; i < best.length - 1; i++) for (let j = i + 1; j < best.length; j++) {
      const trial = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
      if (cost(trial) + .01 < cost(best)) { best = trial; improved = true; }
    }
    if (!improved) break;
  }
  return best;
}
export interface RoutingDependencies { matrix: typeof getMatrix; route: typeof getRoute }
export const routing: RoutingDependencies = { matrix: (points) => getMatrix(points, true), route: getRoute };
export async function planGptDay(list: TourCandidate[], start: GeoPoint, end: GeoPoint | null, date: string, settings: AiTourSettings,
  imposed: boolean, required: Set<string>, deps = routing, commitments: { start: number; end: number; name: string }[] = []): Promise<TourPlan> {
  const startMin = timeToMin(settings.work_start), endMin = timeToMin(settings.work_end);
  if (list.length > 80) throw new Error(`La giornata contiene ${list.length} tappe: il calcolo mobile sicuro richiede più giornate. Aumenta maxDays; nessun idoneo è stato eliminato.`);
  if (endMin <= startMin) throw new Error('L’orario di fine deve essere successivo alla partenza.');
  let ordered = [...list], matrixFallback = false;
  if (!imposed && list.length > 1) {
    const matrix = await deps.matrix([start, ...list, ...(end ? [end] : [])]);
    matrixFallback = matrix.fallback;
    ordered = optimizeIndices(list, matrix, startMin, !!end).map((k) => list[k]);
  }
  const route = await deps.route([start, ...ordered, ...(end ? [end] : [])]);
  const warnings: string[] = []; let t = startMin, paused = false;
  const stops = ordered.map((c, index) => {
    const leg = route.legs[index];
    if (!leg) throw new Error('Percorso incompleto: nessuna tappa è stata rimossa. Riprova.');
    let raw = t + leg.durationMin;
    if (!paused && settings.lunch_break_minutes > 0 && raw + c.visitMinutes >= 13 * 60 && startMin < 14 * 60) {
      raw = Math.max(raw, 13 * 60) + settings.lunch_break_minutes; paused = true;
    }
    for (const block of [...commitments].sort((a, b) => a.start - b.start)) {
      if (raw < block.end && raw + c.visitMinutes > block.start) raw = block.end;
    }
    const w = windowArrival(c, raw); t = w.arrival + c.visitMinutes;
    if (w.outside) warnings.push(`${c.name}: fuori fascia visita`);
    if (c.excludedDays?.includes(isoDow(date))) warnings.push(`${c.name}: giorno escluso`);
    return { candidate: c, sequence: index + 1, arrivalMin: w.arrival, departureMin: t,
      travelMinFromPrev: leg.durationMin, travelKmFromPrev: leg.distanceKm,
      waitMin: w.arrival - raw, outsideWindow: w.outside, mandatory: required.has(c.key) };
  });
  const back = end && ordered.length ? route.legs[ordered.length] : null;
  if (end && ordered.length && !back) throw new Error('Tratta di rientro mancante. Riprova.');
  t += back?.durationMin || 0;
  if (t > endMin) warnings.push('Visite e rientro superano l’orario disponibile. Modifica il piano prima di salvare.');
  if (route.fallback || matrixFallback) warnings.push('Routing non verificato: distanze e tempi stimati. Riprova prima di salvare.');
  return { stops, start, end, tourDate: date, startMin, endMin, dayType: 'ai', resolvedDayType: 'mista',
    areaLabel: 'GPTour', geometry: route.latlngs, totalKm: route.totalKm, kmUrban: route.kmUrban, kmExtra: route.kmExtra, kmHighway: route.kmHighway,
    driveMin: route.totalMin, visitMin: ordered.reduce((s, c) => s + c.visitMinutes, 0), bufferMin: Math.max(0, endMin - t),
    returnMin: back?.durationMin || 0, returnKm: back?.distanceKm || 0, finishMin: t,
    potentialValue: ordered.reduce((s, c) => s + c.potentialValue, 0), avgScore: 0, excluded: [],
    aiSummary: 'GPTour · piano deterministico', aiRecommendation: null, warnings, routingFallback: route.fallback || matrixFallback,
    requiredStops: ordered.filter((c) => required.has(c.key)).map((c, i) => ({ key: c.key, name: c.name, priority: i + 1 })),
  };
}
export async function roadKmWithRetry(a: GeoPoint, b: GeoPoint, deps = routing): Promise<number | null> {
  for (let n = 0; n < 2; n++) { try { const r = await deps.route([a, b]); if (!r.fallback && Number.isFinite(r.totalKm)) return r.totalKm; } catch { /* bounded retry, never geometric fallback */ } }
  return null;
}
export const decideReturnHome = (roadKm: number, limit: number): boolean => roadKm < limit;