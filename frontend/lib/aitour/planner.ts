// Planner AI Tour: clustering geografico + selezione greedy + 2-opt + timeline.
// Massimo 2 chiamate OSRM per generazione (matrice + percorso finale).
import type { TourCandidate, TourPlan, PlannedStop, GeoPoint, DayType } from './types';
import { haversineKm } from './types';
import { getMatrix, getRoute } from './osrm';
import { pointInZones, type TerritoryZone } from './territories';
import { VISIT_SLOT_TOLERANCE_MIN, WEEKDAY_NAMES, isoWeekday } from '../visit-slots';
import { balanceJourneyCandidates } from './brief-journey';
import { assertMandatoryFeasible } from './brief-feasibility';
import { provinceCode } from './brief-area';

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
  enforceJourneyOrder?: boolean;
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
  /** Rientro flessibile: il percorso termina verso "end" ma il viaggio di ritorno può sforare l'orario */
  returnFlexible?: boolean;
}

const MAX_MATRIX_POINTS = 40; // start + max 38 candidati + end (demo OSRM regge fino a ~100)

export function filterByArea(candidates: TourCandidate[], area: AreaFilter, start: GeoPoint): TourCandidate[] {
  if (area.mode === 'territory' && area.zones && area.zones.length > 0) {
    return candidates.filter((c) => pointInZones(c.lat, c.lng, area.zones!));
  }
  if (area.mode === 'province' && area.province) {
    return candidates.filter((c) => !!provinceCode(area.province!) && provinceCode(c.province || '') === provinceCode(area.province!));
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

// Valutazione completa di un ordine: fasce violate, orario di fine (attese incluse) e guida.
// Costo lessicografico: violazioni >> orario di fine >> guida >> latenza media.
// La latenza (somma degli orari di arrivo) e' il tie-break sui percorsi "lineari"
// andata/ritorno: a parita' di km si visita il cliente alla PRIMA passata, non al ritorno.
function evalOrder(
  order: number[],
  pool: TourCandidate[],
  durMin: (a: number, b: number) => number,
  startMin: number,
  hasEnd: boolean,
  endIdx: number,
  enforceJourneyOrder = false,
): { violations: number; finish: number; drive: number; cost: number } {
  if (enforceJourneyOrder && order.some((idx, i) => i > 0 && (pool[order[i - 1] - 1].journeyStage ?? 0) > (pool[idx - 1].journeyStage ?? 0))) return { violations: Infinity, finish: Infinity, drive: Infinity, cost: Infinity };
  let t = startMin;
  let cur = 0;
  let drive = 0;
  let violations = 0;
  let latency = 0;
  for (const idx of order) {
    const cand = pool[idx - 1];
    const leg = durMin(cur, idx);
    drive += leg;
    const wa = windowArrival(cand, t + leg);
    if (wa.outside) violations++;
    latency += wa.arrival - startMin;
    t = wa.arrival + cand.visitMinutes;
    cur = idx;
  }
  if (hasEnd && order.length > 0) {
    const back = durMin(cur, endIdx);
    drive += back;
    t += back;
  }
  return { violations, finish: t, drive, cost: violations * 100000 + t + drive * 0.2 + latency * 0.03 };
}

// Ottimizzazione ordine tappe: 2-opt (inversione di segmento) + Or-opt (ricollocazione di
// 1-3 tappe consecutive nel punto migliore del giro). A differenza del solo 2-opt, l'Or-opt
// elimina i "ripassaggi" davanti allo stesso punto vendita; il costo tiene conto delle fasce
// orarie preferite (mai peggiorate) e delle attese, non solo della guida.
function improveOrder(
  order: number[],
  pool: TourCandidate[],
  durMin: (a: number, b: number) => number,
  startMin: number,
  hasEnd: boolean,
  endIdx: number,
  enforceJourneyOrder = false,
): number[] {
  const ev = (o: number[]) => evalOrder(o, pool, durMin, startMin, hasEnd, endIdx, enforceJourneyOrder).cost;
  let best = [...order];
  let bestCost = ev(best);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 15) {
    improved = false;
    // 2-opt: inverte il tratto [i..j]
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const alt = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const c = ev(alt);
        if (c < bestCost - 0.1) {
          best = alt;
          bestCost = c;
          improved = true;
        }
      }
    }
    // Or-opt: sposta catene di 1..3 tappe consecutive in un'altra posizione
    for (let len = 1; len <= 3 && len < best.length; len++) {
      for (let i = 0; i + len <= best.length; i++) {
        const chain = best.slice(i, i + len);
        const rest = [...best.slice(0, i), ...best.slice(i + len)];
        for (let j = 0; j <= rest.length; j++) {
          if (j === i) continue;
          const alt = [...rest.slice(0, j), ...chain, ...rest.slice(j)];
          const c = ev(alt);
          if (c < bestCost - 0.1) {
            best = alt;
            bestCost = c;
            improved = true;
          }
        }
      }
    }
  }
  return best;
}

// Stima veloce (senza OSRM) della durata di una giornata su un settore:
// catena nearest-neighbor dalla partenza (haversine * 1.3 strade reali, 45 km/h) + minuti visita
export function estimateDayMin(group: TourCandidate[], start: GeoPoint): number {
  if (group.length === 0) return 0;
  let curLat = start.lat;
  let curLng = start.lng;
  const left = [...group];
  let km = 0;
  while (left.length > 0) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = haversineKm(curLat, curLng, left[i].lat, left[i].lng);
      if (d < bd) { bd = d; bi = i; }
    }
    km += bd;
    curLat = left[bi].lat;
    curLng = left[bi].lng;
    left.splice(bi, 1);
  }
  return (km * 1.3 / 45) * 60 + group.reduce((s, c) => s + c.visitMinutes, 0);
}

// Partizione geografica "a settori" attorno al punto di partenza (cluster-first, route-second):
// - settori angolari contigui, così i giorni non ripassano dalle stesse zone;
// - bilanciamento dei confini per tempo stimato (guida + visite): giornate ~uguali;
// - ordinamento "a catena": ogni settore confina col successivo (l'ultima zona di un
//   giorno è la più vicina alla prima del giorno dopo).
export function sweepPartition(cands: TourCandidate[], start: GeoPoint, k: number): TourCandidate[][] {
  if (k <= 1 || cands.length <= k) return [cands];
  const ang = (c: TourCandidate) => Math.atan2(c.lat - start.lat, c.lng - start.lng);
  const sorted = [...cands].sort((a, b) => ang(a) - ang(b));
  // Ruota la sequenza in modo che il confine iniziale cada nel gap angolare più ampio
  let gapIdx = 0;
  let gapMax = -1;
  for (let i = 0; i < sorted.length; i++) {
    const a1 = ang(sorted[i]);
    const a2 = i === sorted.length - 1 ? ang(sorted[0]) + Math.PI * 2 : ang(sorted[i + 1]);
    if (a2 - a1 > gapMax) { gapMax = a2 - a1; gapIdx = i; }
  }
  const rotated = [...sorted.slice(gapIdx + 1), ...sorted.slice(0, gapIdx + 1)];
  const per = Math.ceil(rotated.length / k);
  const groups: TourCandidate[][] = [];
  for (let i = 0; i < k; i++) {
    const g = rotated.slice(i * per, (i + 1) * per);
    if (g.length > 0) groups.push(g);
  }
  // Bilanciamento: sposta le tappe di confine tra settori adiacenti finché le
  // giornate stimate non sono più o meno uguali (solo se riduce lo squilibrio)
  const est = groups.map((g) => estimateDayMin(g, start));
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < groups.length - 1; i++) {
      const a = groups[i];
      const b = groups[i + 1];
      const diff = est[i] - est[i + 1];
      if (Math.abs(diff) <= 20) continue;
      if (diff > 0 && a.length > 1) {
        const cand = a[a.length - 1];
        const na = estimateDayMin(a.slice(0, -1), start);
        const nb = estimateDayMin([cand, ...b], start);
        if (Math.max(na, nb) < Math.max(est[i], est[i + 1]) - 1) {
          a.pop();
          b.unshift(cand);
          est[i] = na;
          est[i + 1] = nb;
          moved = true;
        }
      } else if (diff < 0 && b.length > 1) {
        const cand = b[0];
        const na = estimateDayMin([...a, cand], start);
        const nb = estimateDayMin(b.slice(1), start);
        if (Math.max(na, nb) < Math.max(est[i], est[i + 1]) - 1) {
          b.shift();
          a.push(cand);
          est[i] = na;
          est[i + 1] = nb;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  // Gruppi troppo piccoli (<3) confluiscono nel vicino adiacente meno carico
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i].length >= 3 || groups.length <= 1) continue;
    const prev = i > 0 ? est[i - 1] : Infinity;
    const next = i < groups.length - 1 ? est[i + 1] : Infinity;
    const j = prev <= next ? i - 1 : i + 1;
    groups[j] = j < i ? groups[j].concat(groups[i]) : groups[i].concat(groups[j]);
    est[j] = estimateDayMin(groups[j], start);
    groups.splice(i, 1);
    est.splice(i, 1);
  }
  // Catena dei settori: ordina i giorni minimizzando la distanza totale tra settori
  // consecutivi (permutazione esatta, max 6 gruppi): l'ultima zona di un giorno
  // resta la più vicina alla prima del giorno successivo
  const centroid = (g: TourCandidate[]) => ({
    lat: g.reduce((s, c) => s + c.lat, 0) / g.length,
    lng: g.reduce((s, c) => s + c.lng, 0) / g.length,
  });
  const cents = groups.map(centroid);
  const dist = (i: number, j: number) => haversineKm(cents[i].lat, cents[i].lng, cents[j].lat, cents[j].lng);
  let bestChain = groups.map((_, i) => i);
  let bestCost = Infinity;
  const permute = (rest: number[], acc: number[], cost: number) => {
    if (cost >= bestCost) return;
    if (rest.length === 0) {
      // a parità di costo preferisce iniziare dal settore più vicino alla partenza
      const startKm = haversineKm(start.lat, start.lng, cents[acc[0]].lat, cents[acc[0]].lng) * 0.25;
      if (cost + startKm < bestCost) { bestCost = cost + startKm; bestChain = [...acc]; }
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      const next = rest[i];
      const step = acc.length > 0 ? dist(acc[acc.length - 1], next) : 0;
      permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, next], cost + step);
    }
  };
  permute(bestChain, [], 0);
  return bestChain.map((i) => groups[i]);
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
  const mandatory = sorted.filter((c) => input.mandatoryKeys.has(c.key)).sort((a, b) => (a.requestedPriority ?? 2) - (b.requestedPriority ?? 2) || b.score - a.score);
  const optionalSorted = sorted.filter((c) => !input.mandatoryKeys.has(c.key));
  const optional = input.enforceJourneyOrder ? balanceJourneyCandidates(optionalSorted) : optionalSorted;
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
      const t = (input.enforceJourneyOrder ? (pool[i - 1].journeyStage ?? 0) * 1000000 : 0) + (pool[i - 1].requestedPriority ?? 2) * 10000 + durMin(currentIdx, i);
      if (t < bestT) { bestT = t; bestI = i; }
    }
    const cand = pool[bestI - 1];
    const waM = windowArrival(cand, clock + durMin(currentIdx, bestI));
    if (waM.outside) {
      warnings.push(`"${cand.name}": arrivo fuori dalla fascia oraria preferita (${slotLabelsOf(cand)})`);
    }
    const backHomeM = end && !input.returnFlexible ? durMin(bestI, endIdx) : 0;
    if (waM.arrival + cand.visitMinutes + backHomeM > usableUntil) {
      warnings.push(`La visita obbligatoria "${cand.name}" porta il giro oltre l'orario pianificabile`);
    }
    clock = waM.arrival + cand.visitMinutes;
    selected.push(bestI);
    inTour.add(bestI);
    currentIdx = bestI;
    mandatoryLeft.delete(bestI);
  }

  // PRINCIPIO ECONOMICO: densità del territorio e vicinanza agli obbligatori.
  // Ogni km/minuto di guida è un costo (carburante + ~6€/h di tempo agente):
  // a parità di interesse si premiano i cluster e si penalizzano i clienti isolati.
  const neighborCount = pool.map((c) =>
    pool.reduce((n, o) => (o !== c && haversineKm(c.lat, c.lng, o.lat, o.lng) <= 5 ? n + 1 : n), 0));
  const isolatedFlag = pool.map((c) =>
    pool.length > 1 && Math.min(...pool.filter((o) => o !== c).map((o) => haversineKm(c.lat, c.lng, o.lat, o.lng))) > 15);
  const nearMandatory = pool.map((c) =>
    mandatory.length > 0 && mandatory.some((m) => m !== c && haversineKm(c.lat, c.lng, m.lat, m.lng) <= 10));

  // Poi le opzionali: score - 1.3*minuti viaggio - 0.5*minuti attesa fascia
  // + correttivi economici (densità, isolamento, zona obbligatori, direzione di rientro)
  for (;;) {
    let bestI = -1;
    let bestVal = -Infinity;
    for (let i = 1; i <= pool.length; i++) {
      if (inTour.has(i)) continue;
      const cand = pool[i - 1];
      if (input.enforceJourneyOrder && currentIdx > 0 && (cand.journeyStage ?? 0) < (pool[currentIdx - 1].journeyStage ?? 0)) continue;
      const wa = windowArrival(cand, clock + durMin(currentIdx, i));
      if (wa.outside) { windowBlockedKeys.add(cand.key); continue; }
      if (wa.wait > 60) { windowBlockedKeys.add(cand.key); continue; } // attesa eccessiva ora: riconsiderato piu' avanti nel giro
      const backHome = end && !input.returnFlexible ? durMin(i, endIdx) : 0;
      if (wa.arrival + cand.visitMinutes + backHome > usableUntil) continue;
      let val = cand.score - durMin(currentIdx, i) * 1.3 - wa.wait * 0.5;
      val += Math.min(10, neighborCount[i - 1] * 2);
      if (isolatedFlag[i - 1] && !nearMandatory[i - 1]) val -= 15;
      if (nearMandatory[i - 1]) val += 10;
      // Con rientro previsto, allontanarsi dalla direzione di casa ha un costo crescente
      if (end) val -= Math.max(0, durMin(i, endIdx) - durMin(currentIdx, endIdx)) * 0.3;
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

  // Miglioramento dell'ordine (2-opt + Or-opt, fasce orarie mai peggiorate: il costo
  // penalizza le violazioni, quindi si accettano solo ordini con violazioni <= greedy)
  if (input.enforceJourneyOrder) selected.sort((a, b) => (pool[a - 1].journeyStage ?? 0) - (pool[b - 1].journeyStage ?? 0));
  let optimized = selected.length > 2 ? improveOrder(selected, pool, durMin, startMin, !!end, endIdx, input.enforceJourneyOrder) : [...selected];

  // Il percorso ottimizzato libera tempo: inserisce i candidati rimasti fuori nella
  // POSIZIONE MIGLIORE del giro (non in coda) — niente piu' "passato davanti e ignorato"
  if (optimized.length > 0) {
    let current = evalOrder(optimized, pool, durMin, startMin, !!end, endIdx, input.enforceJourneyOrder);
    const remaining = pool
      .map((c, i) => ({ c, idx: i + 1 }))
      .filter(({ idx }) => !inTour.has(idx))
      .sort((a, b) => b.c.score - a.c.score);
    let inserted = false;
    for (const { c, idx } of remaining) {
      let bestAlt: number[] | null = null;
      let bestCost = Infinity;
      for (let j = 0; j <= optimized.length; j++) {
        const alt = [...optimized.slice(0, j), idx, ...optimized.slice(j)];
        const e = evalOrder(alt, pool, durMin, startMin, !!end, endIdx, input.enforceJourneyOrder);
        if (e.violations > current.violations) continue;
        const returnLeg = end && input.returnFlexible ? durMin(alt[alt.length - 1], endIdx) : 0;
        if (e.finish - returnLeg > usableUntil) continue;
        if (e.cost < bestCost) {
          bestCost = e.cost;
          bestAlt = alt;
        }
      }
      if (bestAlt) {
        optimized = bestAlt;
        inTour.add(idx);
        windowBlockedKeys.delete(c.key);
        current = evalOrder(optimized, pool, durMin, startMin, !!end, endIdx, input.enforceJourneyOrder);
        inserted = true;
      }
    }
    // Rifinitura dopo gli inserimenti
    if (inserted && optimized.length > 2) optimized = improveOrder(optimized, pool, durMin, startMin, !!end, endIdx, input.enforceJourneyOrder);
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
  // Con rientro flessibile il viaggio di ritorno può sforare: si valuta l'ultima visita
  const overrunCheck = input.returnFlexible ? finishMin - returnMin : finishMin;
  if (overrunCheck > endMin) warnings.push('Il giro termina oltre l\'orario di fine configurato');

  // Avvisi economici: ogni km e ogni minuto alla guida sono un costo reale
  // (carburante/usura ~0,25€/km + costo-opportunità tempo agente ~6€/h)
  if (!input.skipDayExclusion && stops.length >= 1) {
    if (driveMin > visitMin && driveMin >= 120) {
      const dh = Math.floor(driveMin / 60);
      const vh = Math.floor(visitMin / 60);
      warnings.push(`Giro poco efficiente: più tempo alla guida (~${dh}h${Math.round(driveMin % 60)}m) che dai clienti (~${vh}h${Math.round(visitMin % 60)}m)`);
    }
    const tripCost = Math.round(route.totalKm * 0.25 + (driveMin / 60) * 6);
    if (route.totalKm > 120) {
      warnings.push(`Trasferta lunga: ~${Math.round(route.totalKm)} km, costo stimato ~${tripCost}€ tra carburante e tempo di guida: assicurati che il potenziale della zona la giustifichi`);
    }
  }

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
    returnFlexible: input.returnFlexible,
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
  const result: TourPlan = {
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
  assertMandatoryFeasible(result);
  return result;
}
