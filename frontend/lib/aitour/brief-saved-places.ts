import type { BriefPlace, TourBriefV4 } from './brief-v4';
import type { AiTourSettings } from './types';
export function bindSavedPlace(place: BriefPlace | null | undefined, settings: AiTourSettings): BriefPlace | null | undefined {
  if (!place || (place.kind !== 'home' && place.kind !== 'office')) return place;
  const home = place.kind === 'home';
  const address = (home ? settings.home_address : settings.office_address)?.trim() || '';
  const lat = home ? settings.home_lat : settings.office_lat, lng = home ? settings.home_lng : settings.office_lng;
  const valid = !!address && typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  return { kind: place.kind, rawReference: address || (home ? 'Casa' : 'Sede'), point: valid ? { lat, lng, label: address } : undefined };
}
export function bindSavedBriefPlaces(brief: TourBriefV4, settings: AiTourSettings): TourBriefV4 {
  return { ...brief, route: { ...brief.route, startPlace: bindSavedPlace(brief.route.startPlace, settings),
    endPlace: bindSavedPlace(brief.route.endPlace || (brief.route.returnHome ? { kind: 'home', rawReference: 'Casa' } : null), settings) } };
}