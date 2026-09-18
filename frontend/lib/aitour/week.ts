// Vista Settimanale: soggetti in scadenza visita (ultima visita + cadenza) distribuiti in territori per giorno.
import type { TourCandidate, AiTourSettings } from './types';
import { haversineKm, timeToMin } from './types';
import { cadenceWeeksFor, isRecentlyServed } from './scoring';
import { isoWeekday } from '../visit-slots';

export interface WeekDayPlan {
  offset: number;
  date: string;
  dow: string;
  label: string;
  candidates: TourCandidate[];
  dueCount: number;
  estVisitMin: number;
  estDriveMin: number;
  estKm: number;
}

export interface WeekPlan {
  weekStart: string;
  days: WeekDayPlan[];
  capacityPerDay: number;
  usableMinPerDay: number;
  totalDue: number;
  coveredDue: number;
  overflow: TourCandidate[];
}

export const DOW_LABELS = ["Lunedi'", "Martedi'", "Mercoledi'", "Giovedi'", "Venerdi'", 'Sabato'];

export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function nextMonday(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + (7 - dow));
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Cliente "in scadenza visita" entro fine settimana: ultima visita + cadenza (4-5 sett. con storico, 7-8 con pochi ordini)
export function isVisitDue(c: TourCandidate, weekEndMs: number, settings: AiTourSettings): boolean {
  if (c.entityType !== 'client') return false;
  if (!c.lastVisitDate) return true;
  const t = new Date(c.lastVisitDate).getTime();
  if (Number.isNaN(t)) return true;
  return t + cadenceWeeksFor(c, settings) * 7 * 86400000 <= weekEndMs;
}

function centroidOf(g: TourCandidate[]): { lat: number; lng: number } {
  let lat = 0, lng = 0;
  for (const p of g) { lat += p.lat; lng += p.lng; }
  return { lat: lat / g.length, lng: lng / g.length };
}

function kmeans(points: TourCandidate[], k: number): TourCandidate[][] {
  if (k <= 1) return [points];
  if (points.length <= k) {
    return [...points.map((p) => [p]), ...Array.from({ length: k - points.length }, () => [] as TourCandidate[])];
  }
  const centroids = [{ lat: points[0].lat, lng: points[0].lng }];
  while (centroids.length < k) {
    let best = points[0], bestD = -1;
    for (const p of points) {
      const d = Math.min(...centroids.map((c) => haversineKm(c.lat, c.lng, p.lat, p.lng)));
      if (d > bestD) { bestD = d; best = p; }
    }
    centroids.push({ lat: best.lat, lng: best.lng });
  }
  let groups: TourCandidate[][] = centroids.map(() => []);
  for (let iter = 0; iter < 15; iter++) {
    groups = centroids.map(() => []);
    for (const p of points) {
      let gi = 0, gd = Infinity;
      centroids.forEach((c, i) => {
        const d = haversineKm(c.lat, c.lng, p.lat, p.lng);
        if (d < gd) { gd = d; gi = i; }
      });
      groups[gi].push(p);
    }
    let moved = false;
    centroids.forEach((c, i) => {
      if (groups[i].length === 0) return;
      const nc = centroidOf(groups[i]);
      if (Math.abs(nc.lat - c.lat) > 1e-5 || Math.abs(nc.lng - c.lng) > 1e-5) moved = true;
      centroids[i] = nc;
    });
    if (!moved) break;
  }
  return groups;
}

// Sposta i soggetti a punteggio piu' basso dai giorni sovraccarichi al gruppo vicino con spazio
function rebalance(groups: TourCandidate[][], cap: number): void {
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < groups.length; i++) {
      while (groups[i].length > cap) {
        const p = [...groups[i]].sort((a, b) => a.score - b.score)[0];
        let ti = -1, td = Infinity;
        for (let j = 0; j < groups.length; j++) {
          if (j === i || groups[j].length >= cap) continue;
          if (groups[j].length === 0) { ti = j; break; }
          const c = centroidOf(groups[j]);
          const d = haversineKm(c.lat, c.lng, p.lat, p.lng);
          if (d < td) { td = d; ti = j; }
        }
        if (ti === -1) return;
        groups[i] = groups[i].filter((x) => x.key !== p.key);
        groups[ti].push(p);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

// Stima percorso del giorno: catena nearest-neighbor * fattore strada (nessuna chiamata OSRM)
function estimateRoute(cands: TourCandidate[], start: { lat: number; lng: number } | null): { km: number; driveMin: number } {
  if (cands.length === 0) return { km: 0, driveMin: 0 };
  const remaining = [...cands];
  let km = 0;
  let cur: { lat: number; lng: number };
  if (start) {
    remaining.sort((a, b) => haversineKm(start.lat, start.lng, a.lat, a.lng) - haversineKm(start.lat, start.lng, b.lat, b.lng));
    cur = remaining.shift()!;
    km += haversineKm(start.lat, start.lng, cur.lat, cur.lng);
  } else {
    cur = remaining.shift()!;
  }
  while (remaining.length > 0) {
    let bi = 0, bd = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(cur.lat, cur.lng, p.lat, p.lng);
      if (d < bd) { bd = d; bi = i; }
    });
    km += bd;
    cur = remaining.splice(bi, 1)[0];
  }
  km *= 1.4;
  return { km, driveMin: km * 1.05 };
}

export function topCities(cands: TourCandidate[]): string {
  const count = new Map<string, { label: string; n: number }>();
  for (const c of cands) {
    const raw = (c.city || '').trim();
    if (!raw) continue;
    const key = raw.toUpperCase();
    const e = count.get(key);
    if (e) e.n++;
    else count.set(key, { label: raw, n: 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((x) => x.label).join(' / ');
}

// Toglie gli outlier finche' il giorno rientra nella finestra lavorativa ed e' geograficamente compatto
function trimDayToFit(
  g: TourCandidate[],
  start: { lat: number; lng: number } | null,
  usableMin: number,
): { kept: TourCandidate[]; dropped: TourCandidate[]; est: { km: number; driveMin: number } } {
  const kept = [...g];
  const dropped: TourCandidate[] = [];
  let est = estimateRoute(kept, start);
  let guard = 0;
  while (kept.length > 1 && guard++ < 80) {
    const cen = centroidOf(kept);
    const dists = kept.map((c) => haversineKm(cen.lat, cen.lng, c.lat, c.lng));
    const visitMin = kept.reduce((s, c) => s + c.visitMinutes, 0);
    const overTime = visitMin + est.driveMin > usableMin;
    const overRadius = Math.max(...dists) > 50;
    if (!overTime && !overRadius) break;
    let di = 0, worst = -1;
    kept.forEach((c, i) => {
      const v = dists[i] * 1000 + (100 - c.score);
      if (v > worst) { worst = v; di = i; }
    });
    dropped.push(kept.splice(di, 1)[0]);
    est = estimateRoute(kept, start);
  }
  return { kept, dropped, est };
}

export interface WeekOptions {
  candidates: TourCandidate[];
  weekStart: string;
  activeDays: number[];
  settings: AiTourSettings;
  includeFillers: boolean;
  start: { lat: number; lng: number } | null;
}

export function buildWeekPlan(opts: WeekOptions): WeekPlan {
  const { candidates, weekStart, activeDays, settings, includeFillers, start } = opts;
  const weekEndMs = new Date(weekStart + 'T23:59:59').getTime() + 6 * 86400000;
  const workMin = timeToMin(settings.work_end) - timeToMin(settings.work_start);
  const usable = workMin * (1 - (settings.buffer_pct_mista || 25) / 100);
  const capacityPerDay = Math.max(4, Math.floor(usable / (settings.visit_minutes_client + 12)));
  const totalCap = capacityPerDay * activeDays.length;
  const weekEndDate = new Date(weekEndMs).toISOString().slice(0, 10);

  const due = candidates.filter((c) => isVisitDue(c, weekEndMs, settings) && !isRecentlyServed(c, undefined, weekEndDate)).sort((a, b) => b.score - a.score);
  const dueKeys = new Set(due.map((c) => c.key));
  let selected = due.slice(0, totalCap);
  const overflow = due.slice(totalCap);
  if (includeFillers && selected.length < totalCap) {
    // I riempitivi restano nella geografia reale del giro: vicino alla partenza o ai clienti in scadenza
    const anchors = selected.length > 0 ? selected : candidates.filter((c) => c.entityType === 'client');
    const fillers = candidates
      .filter((c) => (c.entityType === 'prospect' || c.entityType === 'orphan' || c.entityType === 'never' || c.entityType === 'free') && !dueKeys.has(c.key) && !isRecentlyServed(c, undefined, weekEndDate))
      .filter((c) => {
        if (start && haversineKm(start.lat, start.lng, c.lat, c.lng) <= 60) return true;
        return anchors.some((a) => haversineKm(a.lat, a.lng, c.lat, c.lng) <= 25);
      })
      .sort((a, b) => b.score - a.score);
    selected = [...selected, ...fillers.slice(0, totalCap - selected.length)];
  }

  const groups = kmeans(selected, activeDays.length);
  rebalance(groups, capacityPerDay);
  // Territorio piu' urgente al giorno piu' vicino
  const ordered = groups
    .map((g) => ({ g, urg: g.length ? g.reduce((s, c) => s + c.score, 0) / g.length : -1 }))
    .sort((a, b) => b.urg - a.urg)
    .map((x) => x.g);

  const droppedDue: TourCandidate[] = [];
  const days: WeekDayPlan[] = activeDays.map((offset, i) => {
    const trimmed = trimDayToFit(ordered[i] || [], start, usable);
    droppedDue.push(...trimmed.dropped.filter((c) => dueKeys.has(c.key)));
    const g = trimmed.kept.sort((a, b) => b.score - a.score);
    return {
      offset,
      date: addDays(weekStart, offset),
      dow: DOW_LABELS[offset],
      label: topCities(g),
      candidates: g,
      dueCount: g.filter((c) => dueKeys.has(c.key)).length,
      estVisitMin: g.reduce((s, c) => s + c.visitMinutes, 0),
      estDriveMin: Math.round(trimmed.est.driveMin),
      estKm: Math.round(trimmed.est.km),
    };
  });

  // Giorni esclusi dal cliente (es. mercoledì mercato): sposta chi e' capitato
  // in un giorno in cui non riceve verso un altro giorno compatibile della settimana
  const isDayExcluded = (c: TourCandidate, date: string) =>
    Array.isArray(c.excludedDays) && c.excludedDays.includes(isoWeekday(date));
  const misplaced: TourCandidate[] = [];
  for (const d of days) {
    const keep = d.candidates.filter((c) => {
      if (!isDayExcluded(c, d.date)) return true;
      misplaced.push(c);
      return false;
    });
    if (keep.length !== d.candidates.length) {
      d.candidates = keep;
      const est = estimateRoute(keep, start);
      d.estVisitMin = keep.reduce((s, c) => s + c.visitMinutes, 0);
      d.estDriveMin = Math.round(est.driveMin);
      d.estKm = Math.round(est.km);
      d.dueCount = keep.filter((c) => dueKeys.has(c.key)).length;
      d.label = topCities(keep);
    }
  }
  for (const c of misplaced.sort((a, b) => b.score - a.score)) {
    let placed = false;
    for (const d of days) {
      if (isDayExcluded(c, d.date)) continue;
      const est = estimateRoute([...d.candidates, c], start);
      const visitMin = d.estVisitMin + c.visitMinutes;
      if (visitMin + est.driveMin > usable) continue;
      d.candidates.push(c);
      d.candidates.sort((a, b) => b.score - a.score);
      d.estVisitMin = visitMin;
      d.estDriveMin = Math.round(est.driveMin);
      d.estKm = Math.round(est.km);
      if (dueKeys.has(c.key)) d.dueCount += 1;
      d.label = topCities(d.candidates);
      placed = true;
      break;
    }
    if (!placed) overflow.push(c);
  }

  // Backfill: reinserisce i clienti in scadenza scartati nei giorni geograficamente compatibili con budget residuo
  const remainingDue: TourCandidate[] = [];
  for (const c of droppedDue.sort((a, b) => b.score - a.score)) {
    let placed = false;
    for (const d of days) {
      if (d.candidates.length === 0) continue;
      if (isDayExcluded(c, d.date)) continue;
      const cen = centroidOf(d.candidates);
      if (haversineKm(cen.lat, cen.lng, c.lat, c.lng) > 45) continue;
      const est = estimateRoute([...d.candidates, c], start);
      const visitMin = d.estVisitMin + c.visitMinutes;
      if (visitMin + est.driveMin > usable) continue;
      d.candidates.push(c);
      d.candidates.sort((a, b) => b.score - a.score);
      d.estVisitMin = visitMin;
      d.estDriveMin = Math.round(est.driveMin);
      d.estKm = Math.round(est.km);
      d.dueCount += 1;
      d.label = topCities(d.candidates);
      placed = true;
      break;
    }
    if (!placed) remainingDue.push(c);
  }

  return {
    weekStart,
    days,
    capacityPerDay,
    usableMinPerDay: Math.round(usable),
    totalDue: due.length,
    coveredDue: days.reduce((s, d) => s + d.dueCount, 0),
    overflow: [...overflow, ...remainingDue].slice(0, 30),
  };
}
