import { bbox } from '@turf/turf';
import type { TourBriefV4 } from './brief-v4';
import type { AiTourSettings, GeoPoint, TourCandidate } from './types';
import { loadFreeTabaccherie, type GeoBounds, type FreeTabFilters } from './data';
import { inBriefArea, provinceCode } from './brief-area';
import { journeyKey } from './brief-journey';

export function wantsDevelopmentRegistry(brief: TourBriefV4): boolean {
  return brief.includeAutomatic !== false && !brief.exclusions.some((x) => x.type === 'prospects')
    && (brief.dayType === 'sviluppo' || brief.dayType === 'mista' || brief.selection.conditions.some((x) => x.type === 'prospects' || x.type === 'new_around'));
}
interface RegistrySearch { bounds: GeoBounds; filters: FreeTabFilters }
const circleBounds = (p: GeoPoint, radius: number): GeoBounds => {
  const dLat = radius / 111, dLng = radius / (111 * Math.cos(p.lat * Math.PI / 180));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
};
export function developmentSearches(brief: TourBriefV4, start?: GeoPoint): RegistrySearch[] {
  if (brief.journey) {
    const j = brief.journey;
    if (!j.preview || j.preview.inputKey !== journeyKey(j)) throw new Error('Conferma prima la località e l’area di sviluppo sulla mappa');
    return j.preview.regions.map((region) => {
      const [minLng, minLat, maxLng, maxLat] = bbox(region);
      return { bounds: { minLat, maxLat, minLng, maxLng }, filters: { refLat: (minLat + maxLat) / 2, refLng: (minLng + maxLng) / 2 } };
    });
  }
  const included = brief.areas.filter((a) => a.mode === 'include');
  if (included.length) return included.map((a) => {
    if (a.kind === 'place') {
      if (!a.point) throw new Error(`Conferma la zona ${a.value}`);
      return { bounds: circleBounds(a.point, a.radiusKm ?? 30), filters: { refLat: a.point.lat, refLng: a.point.lng } };
    }
    return { bounds: { minLat: 35, maxLat: 47.5, minLng: 6, maxLng: 19 }, filters: a.kind === 'province' ? { provincia: provinceCode(a.value) || a.value } : { comune: a.value } };
  });
  return start ? [{ bounds: circleBounds(start, 10), filters: { refLat: start.lat, refLng: start.lng } }] : [];
}
export async function loadBriefDevelopment(brief: TourBriefV4, agentId: string, settings: AiTourSettings, excludeTabIds: Set<string> = new Set(), start?: GeoPoint): Promise<TourCandidate[]> {
  if (!wantsDevelopmentRegistry(brief)) return [];
  const found = new Map<string, TourCandidate>();
  for (const { bounds, filters } of developmentSearches(brief, start)) {
    const rows = await loadFreeTabaccherie(bounds, new Set(), settings, { ...filters, agentId }, 501, true);
    if (rows.length >= 501) throw new Error('Area di sviluppo troppo ampia: riduci raggio o corridoio e riprova');
    for (const c of rows) if (c.tabaccheriaId && !excludeTabIds.has(c.tabaccheriaId) && inBriefArea(c, brief.areas, brief.journey)) found.set(c.tabaccheriaId, c);
  }
  return [...found.values()];
}