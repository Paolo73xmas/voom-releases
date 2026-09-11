import { normalizeProvincia } from '../italy-provinces';
import { haversineKm, type GeoPoint, type TourCandidate } from './types';
import { journeyKey, journeyStageFor, type BriefJourney } from './brief-journey';

export interface TourAreaConstraint {
  kind: 'city' | 'province' | 'place';
  value: string;
  mode: 'include' | 'exclude' | 'prefer';
  point?: GeoPoint;
  radiusKm?: number;
}
export const normalizeLocality = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const provinceCode = (s: string) => normalizeProvincia(s.replace(/^(provincia\s+(di\s+)?|citta\s+metropolitana\s+di\s+)/i, ''))?.sigla ?? null;
type AreaCandidate = Pick<TourCandidate, 'city' | 'province' | 'lat' | 'lng'>;
export const areaConsentKey = (c: AreaCandidate, areas: TourAreaConstraint[], journey?: BriefJourney | null) => JSON.stringify([c.city, c.province, c.lat, c.lng, areas.map((a) => [a.kind, a.value, a.mode, a.point?.lat, a.point?.lng, a.radiusKm]), journey ? journeyKey(journey) : null]);
export function areaProblem(a: TourAreaConstraint): string | null {
  if (a.mode === 'prefer') return null;
  if (a.kind === 'province' && !provinceCode(a.value)) return `Provincia non riconosciuta: ${a.value}`;
  if (a.kind === 'place' && (!a.point || !Number.isFinite(a.point.lat) || !Number.isFinite(a.point.lng))) return `Conferma il centro della zona: ${a.value}`;
  return null;
}
export function matchesArea(c: AreaCandidate, a: TourAreaConstraint): boolean {
  if (a.kind === 'province') return !!provinceCode(a.value) && provinceCode(c.province) === provinceCode(a.value);
  if (a.kind === 'city') return !!c.city && normalizeLocality(c.city) === normalizeLocality(a.value);
  return !!a.point && haversineKm(a.point.lat, a.point.lng, c.lat, c.lng) <= (a.radiusKm ?? 30);
}
// Zero risultati non significa mai autorizzare l'intero portafoglio.
export function inBriefArea(c: AreaCandidate, areas: TourAreaConstraint[], journey?: BriefJourney | null): boolean {
  if (journey && journeyStageFor(c, journey) == null) return false;
  if (areas.some(areaProblem)) return false;
  const includes = areas.filter((a) => a.mode === 'include');
  return (!includes.length || includes.some((a) => matchesArea(c, a))) && !areas.some((a) => a.mode === 'exclude' && matchesArea(c, a));
}
export function outsideAreaReason(c: AreaCandidate, areas: TourAreaConstraint[], journey?: BriefJourney | null): string | null {
  if (inBriefArea(c, areas, journey)) return null;
  if (!c.province && areas.some((a) => a.kind === 'province' && a.mode !== 'prefer')) return 'Provincia mancante: appartenenza alla zona non verificabile';
  return `Fuori zona: ${c.city || 'comune non disponibile'} (${c.province || 'provincia non disponibile'})`;
}