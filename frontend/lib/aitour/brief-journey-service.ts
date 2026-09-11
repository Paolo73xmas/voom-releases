import { geocodePlaceChoices, getRoute } from './osrm';
import { journeyAnchor, makeJourneyPreview, validJourneyPoint, type BriefJourney } from './brief-journey';
import { haversineKm, type GeoPoint } from './types';
import { exactLocality, localityNameOf, suggestPortfolioLocalities, type LocalityChoice, type PortfolioLocality } from './journey-localities';

export async function prepareJourney(input: BriefJourney, portfolio: PortfolioLocality[] = []): Promise<{ journey: BriefJourney; alternatives: Record<number, LocalityChoice[]>; issues: Record<number, string> }> {
  const j: BriefJourney = { ...input, stages: input.stages.map((s) => ({ ...s })), confirmedKey: undefined, preview: undefined };
  const alternatives: Record<number, LocalityChoice[]> = {}, issues: Record<number, string> = {};
  const unresolved = new Map<number, GeoPoint[]>();
  for (let i = 0; i < j.stages.length; i++) {
    const s = j.stages[i];
    if (!s.name) { issues[i] = `Indica la località della zona ${i + 1}`; alternatives[i] = []; continue; }
    if (validJourneyPoint(s.point)) continue;
    try {
      const options = await geocodePlaceChoices(s.name, undefined, true);
      const exact = options.filter((p) => exactLocality(s.name, p));
      if (exact.length === 1) s.point = exact[0];
      else if (exact.length > 1) alternatives[i] = exact.map((p) => ({ ...p, localityName: localityNameOf(p), isCorrection: false, source: 'geocoder' }));
      else unresolved.set(i, options);
    } catch { issues[i] = `Servizio geografico non disponibile per ${s.name}: riprova. La località non è stata sostituita.`; alternatives[i] = []; }
  }
  for (const [i, originalOptions] of unresolved) {
    const s = j.stages[i], verified: LocalityChoice[] = [];
    for (const town of suggestPortfolioLocalities(s.name, portfolio, j.stages)) {
      try {
        const matches = await geocodePlaceChoices(town.city, undefined, true);
        matches.filter((p) => exactLocality(town.city, p) && haversineKm(town.lat, town.lng, p.lat, p.lng) <= 30)
          .forEach((p) => verified.push({ ...p, localityName: localityNameOf(p), isCorrection: true, source: 'portfolio' }));
      } catch { issues[i] = `Verifica dei suggerimenti per ${s.name} temporaneamente non disponibile. Riprova.`; }
    }
    const other = originalOptions.map((p): LocalityChoice => ({ ...p, localityName: localityNameOf(p), isCorrection: true, source: 'geocoder' }));
    alternatives[i] = [...new Map([...verified, ...other].map((p) => [`${p.localityName}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}`, p])).values()].slice(0, 6);
  }
  if (Object.keys(alternatives).length) return { journey: j, alternatives, issues };
  const roads: [number, number][][] = [];
  let km = 0;
  for (let i = 1; i < j.stages.length; i++) {
    const route = await getRoute([journeyAnchor(j.stages[i - 1]), journeyAnchor(j.stages[i])]);
    if (route.fallback || route.latlngs.length < 2) throw new Error('Percorso stradale non disponibile: riprova la mappa. Nessun corridoio stimato verrà confermato.');
    roads.push(route.latlngs.map(([lat, lng]) => [lng, lat])); km += route.totalKm;
  }
  j.preview = makeJourneyPreview(j, roads, km);
  return { journey: j, alternatives, issues };
}