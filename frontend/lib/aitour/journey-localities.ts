import Fuse from 'fuse.js';
import { normalizeLocality } from './brief-area';
import { haversineKm, type GeoPoint } from './types';
import { validJourneyPoint, type JourneyStage } from './brief-journey';
export interface PortfolioLocality { city: string; province: string; lat: number; lng: number }
export interface LocalityChoice extends GeoPoint { localityName: string; isCorrection: boolean; source: 'portfolio' | 'geocoder' }
export const localityNameOf = (p: GeoPoint) => (p.label || '').split(',')[0].trim();
export const exactLocality = (name: string, p: GeoPoint) => !!localityNameOf(p) && normalizeLocality(name) === normalizeLocality(localityNameOf(p));
export function suggestPortfolioLocalities(input: string, rows: PortfolioLocality[], stages: JourneyStage[]): PortfolioLocality[] {
  const groups = new Map<string, PortfolioLocality[]>();
  for (const row of rows) {
    if (!row.city?.trim() || !validJourneyPoint(row)) continue;
    const key = `${normalizeLocality(row.city)}:${row.province.trim().toUpperCase()}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const towns = [...groups.values()].map((g) => ({ city: g[0].city.trim(), province: g[0].province,
    lat: g.map((r) => r.lat).sort((a, b) => a - b)[Math.floor(g.length / 2)], lng: g.map((r) => r.lng).sort((a, b) => a - b)[Math.floor(g.length / 2)] }));
  const anchors = stages.map((s) => s.point).filter((p): p is GeoPoint => validJourneyPoint(p));
  let span = 0;
  for (const a of anchors) for (const b of anchors) span = Math.max(span, haversineKm(a.lat, a.lng, b.lat, b.lng));
  const radius = Math.max(50, span * 1.5);
  const fuse = new Fuse(towns, { keys: ['city'], includeScore: true, ignoreLocation: true, threshold: 0.45, getFn: (row) => normalizeLocality(row.city) });
  return fuse.search(normalizeLocality(input)).map((hit) => {
    const distance = anchors.length ? Math.min(...anchors.map((p) => haversineKm(p.lat, p.lng, hit.item.lat, hit.item.lng))) : 0;
    return { item: hit.item, distance, rank: (hit.score ?? 1) + Math.min(1, distance / radius) * 0.25 };
  }).filter((h) => h.distance <= radius).sort((a, b) => a.rank - b.rank).slice(0, 3).map((h) => h.item);
}