import { booleanPointInPolygon, buffer, circle, destination, difference, distance, featureCollection, lineString, nearestPointOnLine, point, sector, union } from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { GeoPoint, TourCandidate, TourPlan } from './types';
import type { TourBriefV4 } from './brief-v4';

export const DIRECTIONS = { N: 'Nord', NE: 'Nord-est', E: 'Est', SE: 'Sud-est', S: 'Sud', SW: 'Sud-ovest', W: 'Ovest', NW: 'Nord-ovest' };
export type JourneyDirection = keyof typeof DIRECTIONS;
export interface JourneyStage { name: string; direction: JourneyDirection | null; radiusKm: number; point?: GeoPoint; dictatedName?: string }
export interface JourneyPreview { inputKey: string; regions: Feature<Polygon | MultiPolygon>[]; roads: [number, number][][]; roadKm: number }
export interface BriefJourney { stages: JourneyStage[]; corridorKm: number; preview?: JourneyPreview; confirmedKey?: string; inputError?: string }
type Location = Pick<GeoPoint, 'lat' | 'lng'>;
const coords = (p: Location): [number, number] => [p.lng, p.lat];
const BEARINGS: Record<JourneyDirection, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
// Array a posizione fissa: il riordino delle chiavi JSONB non invalida il consenso.
export const journeyKey = (j: BriefJourney) => JSON.stringify([j.stages.map((s) => [s.name, s.direction, s.radiusKm, s.point ? [s.point.lat, s.point.lng, s.point.label || null] : null]), j.corridorKm]);
export const validJourneyPoint = (p?: Location): p is Location => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
export const journeyLabel = (s: JourneyStage) => `${s.direction ? `${DIRECTIONS[s.direction]} di ` : ''}${s.name}`;
export function normalizeJourney(raw: unknown): BriefJourney | null {
  if (!raw) return null;
  const r = raw as Record<string, unknown>;
  const input = Array.isArray(r.stages) ? r.stages : [];
  const j: BriefJourney = { stages: [], corridorKm: typeof r.corridorKm === 'number' && Number.isFinite(r.corridorKm) ? Math.max(0.5, Math.min(15, r.corridorKm)) : 3 };
  if (!input.length || input.length > 8) j.inputError = 'Indica da una a otto zone nel percorso';
  j.stages = input.slice(0, 8).map((s) => {
    const x = s && typeof s === 'object' ? s as Record<string, unknown> : {};
    if (x.direction && !(String(x.direction) in DIRECTIONS)) j.inputError = `Direzione non riconosciuta: ${x.direction}`;
    return { name: typeof x.name === 'string' ? x.name.trim() : '', direction: x.direction && String(x.direction) in DIRECTIONS ? x.direction as JourneyDirection : null,
      radiusKm: typeof x.radiusKm === 'number' && Number.isFinite(x.radiusKm) ? Math.max(1, Math.min(40, x.radiusKm)) : 8 };
  });
  return j; // Non fidarsi mai di coordinate/geometrie/conferme prodotte dall'LLM.
}
export function journeyProblems(j?: BriefJourney | null): string[] {
  if (!j) return [];
  const errors = j.inputError ? [j.inputError] : [];
  if (!j.stages.length) errors.push('Il percorso non contiene zone');
  j.stages.forEach((s, i) => { if (!s.name || !validJourneyPoint(s.point)) errors.push(`Zona ${i + 1}: conferma la località ${s.name}`); });
  if (errors.length) return errors;
  if (!j.preview || j.preview.inputKey !== journeyKey(j)) errors.push('Aggiorna la mappa del percorso e dei corridoi stradali');
  else if (j.confirmedKey !== journeyKey(j)) errors.push('Conferma sulla mappa le zone e il loro ordine');
  return errors;
}
export function journeyAnchor(s: JourneyStage): GeoPoint {
  if (!validJourneyPoint(s.point)) throw new Error(`Località non confermata: ${s.name}`);
  if (!s.direction) return s.point;
  const [lng, lat] = destination(coords(s.point), s.radiusKm * 0.5, BEARINGS[s.direction], { units: 'kilometers' }).geometry.coordinates;
  return { lat, lng, label: journeyLabel(s) };
}
export function makeJourneyPreview(j: BriefJourney, roads: [number, number][][], roadKm: number): JourneyPreview {
  if (roads.length !== j.stages.length - 1 || roads.some((r) => r.length < 2)) throw new Error('Percorso stradale incompleto');
  const regions = j.stages.map((s, i): Feature<Polygon | MultiPolygon> => {
    if (!validJourneyPoint(s.point)) throw new Error(`Coordinate mancanti per ${s.name}`);
    const area = s.direction ? sector(coords(s.point), s.radiusKm, BEARINGS[s.direction] - 45, BEARINGS[s.direction] + 45, { units: 'kilometers', steps: 64 })
      : circle(coords(s.point), i === 0 ? s.radiusKm : j.corridorKm, { units: 'kilometers', steps: 64 });
    if (i === 0) return area;
    const road = buffer(lineString(roads[i - 1]), j.corridorKm, { units: 'kilometers', steps: 12 });
    if (!road) throw new Error('Impossibile costruire il corridoio stradale');
    const approach = s.direction ? difference(featureCollection([road, circle(coords(s.point), s.radiusKm, { units: 'kilometers' })])) : road;
    return approach ? union(featureCollection([approach, area])) || area : area;
  });
  return { inputKey: journeyKey(j), regions, roads, roadKm };
}
export function journeyStageFor(p: Location, j: BriefJourney): number | null {
  if (!validJourneyPoint(p) || j.preview?.inputKey !== journeyKey(j)) return null;
  const pt = point(coords(p));
  const matches = j.preview.regions.map((r, i) => booleanPointInPolygon(pt, r) ? i : -1).filter((i) => i >= 0);
  if (!matches.length) return null;
  const arrivals = matches.filter((i) => i > 0 && booleanPointInPolygon(pt, circle(coords(j.stages[i].point!), j.corridorKm, { units: 'kilometers' })));
  return arrivals.length ? arrivals[0] : matches[0];
}
export function nearestJourneyStage(p: Location, j: BriefJourney): number {
  const match = journeyStageFor(p, j);
  if (match != null) return match;
  let index = 0, min = Infinity;
  j.stages.forEach((s, i) => {
    if (!validJourneyPoint(s.point)) return;
    const d = i > 0 && j.preview?.roads[i - 1]?.length ? nearestPointOnLine(lineString(j.preview.roads[i - 1]), coords(p), { units: 'kilometers' }).properties.dist : distance(coords(s.point), coords(p), { units: 'kilometers' });
    if (d < min) { min = d; index = i; }
  });
  return index;
}
export function assignJourneyStages<T extends TourCandidate>(customers: T[], j?: BriefJourney | null): T[] {
  return j ? customers.map((c) => ({ ...c, journeyStage: nearestJourneyStage(c, j) })) : customers;
}
export function balanceJourneyCandidates<T extends TourCandidate>(customers: T[]): T[] {
  const groups = new Map<number, T[]>();
  [...customers].sort((a, b) => b.score - a.score).forEach((c) => { const k = c.journeyStage ?? 0; groups.set(k, [...(groups.get(k) || []), c]); });
  const queues = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
  const out: T[] = [];
  for (let i = 0; queues.some((g) => i < g.length); i++) queues.forEach((g) => { if (g[i]) out.push(g[i]); });
  return out;
}
export function bindJourneyEnd(brief: TourBriefV4): TourBriefV4 {
  const j = brief.journey;
  if (!j || brief.route.returnHome || brief.route.returnToStart || (brief.route.endPlace && brief.route.endPlace.source !== 'journey')) return brief;
  const last = j.stages[j.stages.length - 1];
  if (!last) return brief;
  return { ...brief, route: { ...brief.route, endPlace: { kind: 'address', source: 'journey', rawReference: journeyLabel(last), point: j.preview?.inputKey === journeyKey(j) ? journeyAnchor(last) : undefined } } };
}
export function journeyPlanProblems(plan: TourPlan): string[] {
  const j = plan.areaFilter?.briefJourney;
  if (!j) return [];
  const errors = journeyProblems(j);
  let previous = -1;
  const visited = new Set<number>();
  for (const s of plan.stops) {
    const stage = s.candidate.journeyStage ?? nearestJourneyStage(s.candidate, j);
    if (stage < previous) errors.push('L’ordine delle zone è stato invertito: ripristina la sequenza geografica prima di confermare');
    previous = stage; visited.add(stage);
    if (s.outsideWindow) errors.push(`${s.candidate.name}: fascia oraria incompatibile con la sequenza geografica`);
  }
  for (const s of plan.areaFilter?.journeyStageCounts || []) if (s.eligible > 0 && !visited.has(s.index)) errors.push(`${s.label}: nessuna visita pianificata nonostante ${s.eligible} clienti disponibili. Rivedi orari, numero visite o zone.`);
  if (plan.routingFallback) errors.push('Tempi stradali non verificati: riprova il calcolo prima di confermare il percorso');
  if (plan.finishMin - (plan.returnFlexible ? plan.returnMin : 0) > plan.endMin) errors.push('Visite e arrivo finale superano l’orario disponibile');
  return errors;
}