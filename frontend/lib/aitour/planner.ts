// Planner AI Tour: clustering geografico + selezione greedy + 2-opt + timeline.
// Massimo 2 chiamate OSRM per generazione (matrice + percorso finale).
import type { TourCandidate, TourPlan, PlannedStop, GeoPoint, DayType } from './types';
import { haversineKm } from './types';
import { getMatrix, getRoute } from './osrm';
import { pointInZones, type TerritoryZone } from './territories';
import { VISIT_SLOT_TOLERANCE_MIN, WEEKDAY_NAMES, isoWeekday } from '../visit-slots';

// Finestre di arrivo ammesse dalla fascia preferita del cliente:
// tolleranza ±30 minuti su tutte le fasce TRANNE quelle "strict" (pranzo 11.30-14.30)
function allowedWindows(c: TourCandidate): { earliest: number; latest: number }[] | null {
  const slots = c.preferredSlots;
  if (!slots || slots.length === 0) return null;
  return slots.map((s) => s.strict
    ? { earliest: s.start, latest: s.end }
    : { earliest: s.start - VISIT_SLOT_TOLERANCE_MIN, latest: s.end + VISIT_SLOT_TOLERANCE_MIN });
}

// Arrivo effettivo rispettando la fascia: attende se in anticipo, outside=true se tutte superate
function windowArrival(c: TourCandidate, rawArrival: number): { arrival: number; wait: number; outside: boolean } {
  const wins = allowedWindows(c);
  if (!wins) return { arrival: rawArrival, wait: 0, outside: false };
  let best: number | null = null;
  for (const w of wins) {
    if (rawArrival <= w.latest) {
      const eff = Math.max(rawArrival, w.earliest);
      if (best === null || eff < best) best = eff;
    }
  }
  if (best === null) return { arrival: rawArrival, wait: 0, outside: true };
  return { arrival: best, wait: best - rawArrival, outside: false };
}

function slotLabelsOf(c: TourCandidate): string {
  return (c.preferredSlots || []).map((s) => s.label).join(', ');
}

export interface AreaFilter {
  mode: 'auto' | 'territory' | 'province' | 'city' | 'radius';
  province?: string;
  city?: string;
  radiusKm?: number;
  zones?: TerritoryZone[];
}

export interface PlanInput {
  candidates: TourCandidate[];
  mandatoryKeys: Set<string>;
  start: GeoPoint;
  end: GeoPoint | null;
  tourDate: string;
  startMin: number;
  endMin: number;
  dayType: DayType;
  resolvedDayType: Exclude<DayType, 'ai'>;
  bufferPct: number;
  bufferMaxMin?: number;
  area: AreaFilter;
  /** Replan live: non applicare l'esclusione dei giorni (tappe già confermate nel giro) */
  skipDayExclusion?: boolean;
}

const MAX_MATRIX_POINTS = 40; // start + max 38 candidati + end (demo OSRM regge fino a ~100)

export function filterByArea(candidates: TourCandidate[], area: AreaFilter, start: GeoPoint): TourCandidate[] {
  if (area.mode === 'territory' && area.zones && area.zones.length > 0) {
    return candidates.filter((c) => pointInZones(c.lat, c.lng, area.zones!));
  }
  if (area.mode === 'province' && area.province) {
    return candidates.filter((c) => (c.province || '').trim().toUpperCase() === area.province!.trim().toUpperCase());
  }
  if (area.mode === 'city' && area.city) {
    return candidates.filter((c) => (c.city || '').trim().toLowerCase() === area.city!.trim().toLowerCase());
  }
  if (area.mode === 'radius' && area.radiusKm) {
    return candidates.filter((c) => haversineKm(start.lat, start.lng, c.lat, c.lng) <= area.radiusKm!);
  }
  return candidates;
}

// Clustering a griglia (~5 km): sceglie la zona con maggior valore commerciale
export function pickBestCluster(candidates: TourCandidate[], start: GeoPoint): { list: TourCandidate[]; label: string } {
  if (candidates.length === 0) return { list: [], label: '' };
  const CELL = 0.05;
  const cells = new Map<string, { score: number; lat: number; lng: number; n: number }>();
  for (const c of candidates) {
    const key = `${Math.floor(c.lat / CELL)}:${Math.floor(c.lng / CELL)}`;
    const e = cells.get(key) || { score: 0, lat: 0, lng: 0, n: 0 };
    e.score += c.score;
    e.lat += c.lat;
    e.lng += c.lng;
    e.n++;
    cells.set(key, e);
  }
  // Zone oltre MAX_CLUSTER_KM dalla partenza sono escluse dalla scelta; se nessuna zona e'
  // raggiungibile si ripiega sulla piu' vicina (evita giri assurdi tipo Roma -> Taranto).
  const MAX_CLUSTER_KM = 120;
  let best: { score: number; lat: number; lng: number } | null = null;
  let nearest: { dist: number; lat: number; lng: number } | null = null;
  for (const [key, e] of cells) {
    const [gy, gx] = key.split(':').map(Number);
    let total = e.score;
    for (const [k2, e2] of cells) {
      if (k2 === key) continue;
      const [oy, ox] = k2.split(':').map(Number);
      if (Math.abs(oy - gy) <= 1 && Math.abs(ox - gx) <= 1) total += e2.score * 0.5;
    }
    const centerLat = e.lat / e.n;
    const centerLng = e.lng / e.n;
    const distKm = haversineKm(start.lat, start.lng, centerLat, centerLng);
    // leggera penalita' per zone molto lontane dalla partenza
    total -= Math.min(40, distKm * 0.6);
    if (!nearest || distKm < nearest.dist) nearest = { dist: distKm, lat: centerLat, lng: centerLng };
    if (distKm <= MAX_CLUSTER_KM && (!best || total > best.score)) best = { score: total, lat: centerLat, lng: centerLng };
  }
  if (!best && nearest) best = { score: 0, lat: nearest.lat, lng: nearest.lng };
  if (!best) return { list: candidates, label: '' };
  let radius = 9;
  let list = candidates.filter((c) => haversineKm(best!.lat, best!.lng, c.lat, c.lng) <= radius);
  if (list.length < 6) {
    radius = 16;
    list = candidates.filter((c) => haversineKm(best!.lat, best!.lng, c.lat, c.lng) <= radius);
  }
  const cityCount = new Map<string, number>();
  for (const c of list) cityCount.set(c.city, (cityCount.get(c.city) || 0) + 1);
  const topCities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([city]) => city).filter(Boolean);
  return { list, label: topCities.join(' / ') };
}

function twoOpt(order: number[], dur: (number | null)[][], hasEnd: boolean, endIdx: number): number[] {
  const D = (a: number, b: number) => dur[a]?.[b] ?? 999999;
  const seq = [...order];
  const cost = (s: number[]) => {
    let t = D(0, s[0]);
    for (let i = 1; i < s.length; i++) t += D(s[i - 1], s[i]);
    if (hasEnd && s.length > 0) t += D(s[s.length - 1], endIdx);
    return t;
  };
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    for (let i = 0; i < seq.length - 1; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        const alt = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
        if (cost(alt) < cost(seq) - 1) {
          seq.splice(0, seq.length, ...alt);
          improved = true;
        }
      }
    }
  }
  return seq;
}

export async function planTour(input: PlanInput): Promise<TourPlan> {
  const { start, end, startMin, endMin, bufferPct } = input;
  const warnings: string[] = [];
  const availableMin = endMin - startMin;
  // Margine di sicurezza: percentuale della giornata ma MAI oltre 60 minuti
  // (giornate intensive: lo scarto complessivo deve restare entro ~1h30)
  const bufferReserve = Math.min(Math.round((availableMin * bufferPct) / 100), input.bufferMaxMin ?? 60);
  const usableUntil = endMin - bufferReserve;

  // Giorni esclusi dal cliente (es. mercoledì mercato): fuori dal giro di quel giorno
  const tourDow = isoWeekday(input.tourDate);
  const tourDayName = WEEKDAY_NAMES[tourDow] || '';
  const dayExcluded: { candidate: TourCandidate; why: string }[] = [];
  const dayCandidates = input.skipDayExclusion ? input.candidates : input.candidates.filter((c) => {
    if (!Array.isArray(c.excludedDays) || !c.excludedDays.includes(tourDow)) return true;
    if (input.mandatoryKeys.has(c.key)) {
      warnings.push(`"${c.name}": il cliente non riceve visite il ${tourDayName}, mantenuta perche' obbligatoria`);
      return true;
    }
    dayExcluded.push({ candidate: c, why: `Il cliente non riceve visite il ${tourDayName}` });
    return false;
  });

  // Ordina per punteggio, obbligatorie sempre incluse, cap per matrice OSRM
  const sorted = [...dayCandidates].sort((a, b) => b.score - a.score);
  const mandatory = sorted.filter((c) => input.mandatoryKeys.has(c.key));
  const optional = sorted.filter((c) => !input.mandatoryKeys.has(c.key));
  const capOptional = Math.max(0, MAX_MATRIX_POINTS - 2 - mandatory.length);
  const pool = [...mandatory, ...optional.slice(0, capOptional)];

  const points = [
    { lat: start.lat, lng: start.lng },
    ...pool.map((c) => ({ lat: c.lat, lng: c.lng })),
    ...(end ? [{ lat: end.lat, lng: end.lng }] : []),
  ];
  const matrix = await getMatrix(points);
  const endIdx = end ? points.length - 1 : -1;
  const durMin = (a: number, b: number) => ((matrix.durations[a]?.[b] ?? 999999) as number) / 60;

  // Selezione greedy: massimizza (punteggio - penalita' viaggio) rispettando l'orario
  const selected: number[] = []; // indici in points (1..pool.length)
  const inTour = new Set<number>();
  let currentIdx = 0;
  let clock = startMin;
  const mandatoryIdx = new Set(mandatory.map((_, i) => i + 1));

  const windowBlockedKeys = new Set<string>();

  // Prima le obbligatorie (in ordine greedy tra loro), incluse anche se sforano (con warning)
  const mandatoryLeft = new Set(mandatoryIdx);
  while (mandatoryLeft.size > 0) {
    let bestI = -1;
    let bestT = Infinity;
    for (const i of mandatoryLeft) {
      const t = durMin(currentIdx, i);
      if (t < bestT) { bestT = t; bestI = i; }
    }
    const cand = pool[bestI - 1];
    const waM = windowArrival(cand, clock + durMin(currentIdx, bestI));
    if (waM.outside) {
      warnings.push(`"${cand.name}": arrivo fuori dalla fascia oraria preferita (${slotLabelsOf(cand)})`);
    }
    const backHomeM = end ? durMin(bestI, endIdx) : 0;
    if (waM.arrival + cand.visitMinutes + backHomeM > usableUntil) {
      warnings.push(`La visita obbligatoria "${cand.name}" porta il giro oltre l'orario pianificabile`);
    }
    clock = waM.arrival + cand.visitMinutes;
    selected.push(bestI);
    inTour.add(bestI);
    currentIdx = bestI;
    mandatoryLeft.delete(bestI);
  }

  // Poi le opzionali: score - 1.3*minuti viaggio - 0.5*minuti attesa fascia
  for (;;) {
    let bestI = -1;
    let bestVal = -Infinity;
    for (let i = 1; i <= pool.length; i++) {
      if (inTour.has(i)) continue;
      const cand = pool[i - 1];
      const wa = windowArrival(cand, clock + durMin(currentIdx, i));
      if (wa.outside) { windowBlockedKeys.add(cand.key); continue; }
      if (wa.wait > 60) { windowBlockedKeys.add(cand.key); continue; } // attesa eccessiva ora: riconsiderato piu' avanti nel giro
      const backHome = end ? durMin(i, endIdx) : 0;
      if (wa.arrival + cand.visitMinutes + backHome > usableUntil) continue;
      const val = cand.score - durMin(currentIdx, i) * 1.3 - wa.wait * 0.5;
      if (val > bestVal) { bestVal = val; bestI = i; }
    }
    if (bestI === -1) break;
    const cand = pool[bestI - 1];
    const wa = windowArrival(cand, clock + durMin(currentIdx, bestI));
    windowBlockedKeys.delete(cand.key);
    clock = wa.arrival + cand.visitMinutes;
    selected.push(bestI);
    inTour.add(bestI);
    currentIdx = bestI;
  }

  // Miglioramento 2-opt sulla sequenza (start fisso, end fisso se presente).
  // Se il riordino viola le fasce orarie preferite, si mantiene la sequenza greedy.
  const violatesWindows = (order: number[]): boolean => {
    let tt = startMin;
    let cur = 0;
    for (const idx of order) {
      const cand = pool[idx - 1];
      const wa = windowArrival(cand, tt + durMin(cur, idx));
      if (wa.outside) return true;
      tt = wa.arrival + cand.visitMinutes;
      cur = idx;
    }
    return false;
  };
  let optimized = selected.length > 2 ? twoOpt(selected, matrix.durations, !!end, endIdx) : selected;
  const anyWindows = selected.some((i) => (pool[i - 1].preferredSlots?.length || 0) > 0);
  if (anyWindows && optimized !== selected && violatesWindows(optimized) && !violatesWindows(selected)) {
    optimized = selected;
  }

  // Percorso finale per geometria e tempi reali
  const routePoints = [
    { lat: start.lat, lng: start.lng },
    ...optimized.map((i) => ({ lat: pool[i - 1].lat, lng: pool[i - 1].lng })),
    ...(end ? [{ lat: end.lat, lng: end.lng }] : []),
  ];
  const route = optimized.length > 0 ? await getRoute(routePoints) : { latlngs: [], legs: [], totalKm: 0, totalMin: 0, fallback: matrix.fallback, kmUrban: null, kmExtra: null, kmHighway: null };

  // Timeline
  const stops: PlannedStop[] = [];
  let t = startMin;
  let driveMin = 0;
  let visitMin = 0;
  optimized.forEach((idx, i) => {
    const cand = pool[idx - 1];
    const leg = route.legs[i] || { durationMin: durMin(i === 0 ? 0 : optimized[i - 1], idx), distanceKm: 0 };
    driveMin += leg.durationMin;
    const wa = windowArrival(cand, t + leg.durationMin);
    if (wa.outside) warnings.push(`"${cand.name}": arrivo previsto fuori dalla fascia oraria preferita (${slotLabelsOf(cand)})`);
    const arrival = wa.arrival;
    t = arrival + cand.visitMinutes;
    visitMin += cand.visitMinutes;
    stops.push({
      candidate: cand,
      sequence: i + 1,
      arrivalMin: arrival,
      departureMin: t,
      travelMinFromPrev: leg.durationMin,
      travelKmFromPrev: leg.distanceKm,
      waitMin: Math.round(wa.wait),
      outsideWindow: wa.outside,
      mandatory: input.mandatoryKeys.has(cand.key),
    });
  });
  let returnMin = 0;
  let returnKm = 0;
  if (end && optimized.length > 0) {
    const lastLeg = route.legs[optimized.length];
    returnMin = lastLeg?.durationMin ?? durMin(optimized[optimized.length - 1], endIdx);
    returnKm = lastLeg?.distanceKm ?? 0;
    driveMin += returnMin;
    t += returnMin;
  }
  const finishMin = t;
  if (finishMin > endMin) warnings.push('Il giro termina oltre l\'orario di fine configurato');

  // Avviso giro multi-zona: tappe molto distanti tra loro (es. Voghera + Lomellina).
  // Solo in generazione (nei replan live le tappe sono gia' confermate dall'agente).
  if (!input.skipDayExclusion && stops.length >= 2) {
    let maxKm = 0;
    let far: [TourCandidate, TourCandidate] | null = null;
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const km = haversineKm(stops[i].candidate.lat, stops[i].candidate.lng, stops[j].candidate.lat, stops[j].candidate.lng);
        if (km > maxKm) { maxKm = km; far = [stops[i].candidate, stops[j].candidate]; }
      }
    }
    if (maxKm > 25 && far) {
      const a = far[0].city || far[0].name;
      const b = far[1].city || far[1].name;
      warnings.push(`Il giro copre zone distanti ~${Math.round(maxKm)} km in linea d'aria (${a} ↔ ${b}): valuta se dividerle su giornate diverse`);
    }
  }
  // Avviso giro lontano dalla partenza: cluster compatto ma a decine di km dalla base dell'agente
  if (!input.skipDayExclusion && stops.length >= 1) {
    let minStartKm = Infinity;
    let nearCity = '';
    for (const s of stops) {
      const km = haversineKm(start.lat, start.lng, s.candidate.lat, s.candidate.lng);
      if (km < minStartKm) { minStartKm = km; nearCity = s.candidate.city || s.candidate.name; }
    }
    if (minStartKm > 25) {
      warnings.push(`Tutte le tappe sono ad almeno ~${Math.round(minStartKm)} km dalla partenza (zona ${nearCity}): trasferimento iniziale lungo, valuta un punto di partenza o un'area diversa`);
    }
  }

  const excluded = pool
    .map((c, i) => ({ c, i: i + 1 }))
    .filter(({ i }) => !inTour.has(i))
    .sort((a, b) => b.c.score - a.c.score)
    .slice(0, 12)
    .map(({ c }) => ({
      candidate: c,
      why: windowBlockedKeys.has(c.key)
        ? 'Fascia oraria preferita non compatibile con il giro'
        : c.score >= 60 ? 'Non rientrava nell\'orario disponibile' : 'Priorita\' piu\' bassa rispetto alle visite scelte',
    }));
  const allExcluded = [...dayExcluded, ...excluded];

  const scores = stops.map((s) => s.candidate.score);
  return {
    stops,
    geometry: route.latlngs,
    start,
    end,
    tourDate: input.tourDate,
    startMin,
    endMin,
    dayType: input.dayType,
    resolvedDayType: input.resolvedDayType,
    areaLabel: '',
    totalKm: route.totalKm,
    kmUrban: route.kmUrban,
    kmExtra: route.kmExtra,
    kmHighway: route.kmHighway,
    driveMin,
    visitMin,
    bufferMin: Math.max(0, endMin - finishMin),
    returnMin,
    returnKm,
    finishMin,
    potentialValue: stops.reduce((s, x) => s + x.candidate.potentialValue, 0),
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    excluded: allExcluded,
    aiSummary: '',
    aiRecommendation: null,
    warnings,
    routingFallback: matrix.fallback || route.fallback,
  };
}

// Un punto vendita = una sola tappa: rete di sicurezza contro candidati doppi
// provenienti da fonti diverse (es. prospect + orfano della stessa tabaccheria)
function dedupeCandidates(list: TourCandidate[]): TourCandidate[] {
  const seenTabs = new Set<string>();
  const seenCust = new Set<string>();
  const out: TourCandidate[] = [];
  for (const c of list) {
    if (c.tabaccheriaId && seenTabs.has(c.tabaccheriaId)) continue;
    if (c.customerId && seenCust.has(c.customerId)) continue;
    if (c.tabaccheriaId) seenTabs.add(c.tabaccheriaId);
    if (c.customerId) seenCust.add(c.customerId);
    out.push(c);
  }
  return out;
}

export function candidatesForDayType(
  pool: { clients: TourCandidate[]; prospects: TourCandidate[]; orphans: TourCandidate[] },
  dayType: Exclude<DayType, 'ai'>,
): TourCandidate[] {
  if (dayType === 'clienti') return dedupeCandidates(pool.clients);
  if (dayType === 'sviluppo') {
    // sviluppo territorio: prospect + orfani + clienti propri "da recuperare" (molto in ritardo)
    const daRecuperare = pool.clients.filter((c) => (c.daysSinceOrder ?? 0) > 60 && c.score >= 60);
    return dedupeCandidates([...pool.prospects, ...pool.orphans, ...daRecuperare]);
  }
  return dedupeCandidates([...pool.clients, ...pool.prospects, ...pool.orphans]);
}

// Ricalcolo con sequenza manuale fissa: solo percorso + timeline (nessuna riottimizzazione)
export async function planFixedOrder(ordered: TourCandidate[], base: TourPlan): Promise<TourPlan> {
  const points = [
    { lat: base.start.lat, lng: base.start.lng },
    ...ordered.map((c) => ({ lat: c.lat, lng: c.lng })),
    ...(base.end ? [{ lat: base.end.lat, lng: base.end.lng }] : []),
  ];
  const route = await getRoute(points);
  const stops: PlannedStop[] = [];
  let t = base.startMin;
  let driveMin = 0;
  let visitMin = 0;
  const mandatorySet = new Set(base.stops.filter((s) => s.mandatory).map((s) => s.candidate.key));
  const windowWarnings: string[] = [];
  const fixedDow = isoWeekday(base.tourDate);
  ordered.forEach((cand, i) => {
    const leg = route.legs[i] || { durationMin: 0, distanceKm: 0 };
    driveMin += leg.durationMin;
    const wa = windowArrival(cand, t + leg.durationMin);
    if (wa.outside) windowWarnings.push(`"${cand.name}": arrivo fuori dalla fascia oraria preferita (${slotLabelsOf(cand)})`);
    if (Array.isArray(cand.excludedDays) && cand.excludedDays.includes(fixedDow)) {
      windowWarnings.push(`"${cand.name}": il cliente non riceve visite il ${WEEKDAY_NAMES[fixedDow] || 'giorno scelto'}`);
    }
    const arrival = wa.arrival;
    t = arrival + cand.visitMinutes;
    visitMin += cand.visitMinutes;
    stops.push({
      candidate: cand,
      sequence: i + 1,
      arrivalMin: arrival,
      departureMin: t,
      travelMinFromPrev: leg.durationMin,
      travelKmFromPrev: leg.distanceKm,
      waitMin: Math.round(wa.wait),
      outsideWindow: wa.outside,
      mandatory: mandatorySet.has(cand.key),
    });
  });
  let returnMin = 0;
  let returnKm = 0;
  if (base.end && ordered.length > 0) {
    const lastLeg = route.legs[ordered.length];
    returnMin = lastLeg?.durationMin ?? 0;
    returnKm = lastLeg?.distanceKm ?? 0;
    driveMin += returnMin;
    t += returnMin;
  }
  const warnings: string[] = [...windowWarnings];
  if (t > base.endMin) warnings.push('La sequenza manuale termina oltre l\'orario di fine configurato');
  const scores = stops.map((s) => s.candidate.score);
  return {
    ...base,
    stops,
    geometry: route.latlngs,
    totalKm: route.totalKm,
    kmUrban: route.kmUrban,
    kmExtra: route.kmExtra,
    kmHighway: route.kmHighway,
    driveMin,
    visitMin,
    bufferMin: Math.max(0, base.endMin - t),
    returnMin,
    returnKm,
    finishMin: t,
    potentialValue: stops.reduce((s, x) => s + x.candidate.potentialValue, 0),
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    excluded: [],
    warnings,
    routingFallback: route.fallback,
  };
}
