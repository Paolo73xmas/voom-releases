// Vista Mensile: blocchi settimana rimanenti nel mese; clienti nella settimana di scadenza (cadenza) + carico bilanciato.
import type { TourCandidate, AiTourSettings } from './types';
import { haversineKm, timeToMin } from './types';
import { cadenceWeeksFor } from './scoring';
import { mondayOf, addDays, topCities } from './week';

export interface MonthWeekBlock {
  weekStart: string;
  label: string;
  due: TourCandidate[];
  fillers: TourCandidate[];
  capacity: number;
  territories: string;
  overloaded: boolean;
}

export interface MonthPlan {
  monthRef: string;
  weeks: MonthWeekBlock[];
  totalDue: number;
  coveredDue: number;
  laterDue: number;
  unplaced: TourCandidate[];
  capacityPerWeek: number;
}

// Capacita' realistica per giorno (post ottimizzazione percorso) rispetto a quella teorica
const REAL_DAY_FACTOR = 0.6;
const WEEK_MS = 7 * 86400000;

export function currentMonthRef(): string {
  return new Date().toISOString().slice(0, 7);
}

// Lunedi' delle settimane RIMANENTI nel mese (dalla settimana corrente/inizio mese all'ultimo lunedi' del mese)
export function monthWeekStarts(monthRef: string): string[] {
  const [y, m] = monthRef.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEndStr = `${monthRef}-${String(lastDay).padStart(2, '0')}`;
  const monthStartStr = `${monthRef}-01`;
  const todayStr = new Date().toISOString().slice(0, 10);
  const fromStr = todayStr > monthStartStr ? todayStr : monthStartStr;
  if (fromStr > monthEndStr) return [];
  let mon = mondayOf(fromStr);
  const out: string[] = [];
  while (mon <= monthEndStr) {
    out.push(mon);
    mon = addDays(mon, 7);
  }
  return out;
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

export interface MonthOptions {
  candidates: TourCandidate[];
  monthRef: string;
  daysPerWeek: number;
  settings: AiTourSettings;
  includeFillers: boolean;
  start: { lat: number; lng: number } | null;
}

export function buildMonthPlan(opts: MonthOptions): MonthPlan {
  const { candidates, monthRef, daysPerWeek, settings, includeFillers, start } = opts;
  const starts = monthWeekStarts(monthRef);
  if (starts.length === 0) {
    return { monthRef, weeks: [], totalDue: 0, coveredDue: 0, laterDue: 0, unplaced: [], capacityPerWeek: 0 };
  }
  const workMin = timeToMin(settings.work_end) - timeToMin(settings.work_start);
  const usable = workMin * (1 - (settings.buffer_pct_mista || 25) / 100);
  const dayCap = Math.max(4, Math.floor(usable / (settings.visit_minutes_client + 12)));
  const capacityPerWeek = Math.max(daysPerWeek * 4, Math.round(dayCap * REAL_DAY_FACTOR * daysPerWeek));

  const weeksDue: TourCandidate[][] = starts.map(() => []);
  const firstMs = new Date(starts[0] + 'T00:00:00').getTime();
  const lastEndMs = new Date(starts[starts.length - 1] + 'T23:59:59').getTime() + 6 * 86400000;
  let laterDue = 0;

  for (const c of candidates) {
    if (c.entityType !== 'client') continue;
    let dueMs = 0;
    if (c.lastVisitDate) {
      const t = new Date(c.lastVisitDate).getTime();
      dueMs = Number.isNaN(t) ? 0 : t + cadenceWeeksFor(c, settings) * WEEK_MS;
    }
    if (dueMs > lastEndMs) { laterDue++; continue; }
    const idx = Math.min(starts.length - 1, Math.max(0, Math.floor((dueMs - firstMs) / WEEK_MS)));
    weeksDue[idx].push(c);
  }

  // Bilanciamento: spill in avanti dei meno prioritari, poi anticipo nelle settimane con spazio
  for (let i = 0; i < weeksDue.length; i++) {
    weeksDue[i].sort((a, b) => b.score - a.score);
    if (i < weeksDue.length - 1) {
      while (weeksDue[i].length > capacityPerWeek) weeksDue[i + 1].push(weeksDue[i].pop()!);
    }
  }
  const unplaced: TourCandidate[] = [];
  const last = weeksDue.length - 1;
  weeksDue[last].sort((a, b) => b.score - a.score);
  while (weeksDue[last].length > capacityPerWeek) {
    const c = weeksDue[last].pop()!;
    const target = weeksDue.findIndex((w) => w.length < capacityPerWeek);
    if (target === -1) unplaced.push(c);
    else weeksDue[target].push(c);
  }

  // Riempitivi nella geografia del giro, distribuiti a rotazione nelle settimane con spazio
  const weekFillers: TourCandidate[][] = starts.map(() => []);
  const totalSpace = weeksDue.reduce((s, w) => s + Math.max(0, capacityPerWeek - w.length), 0);
  if (includeFillers && totalSpace > 0) {
    const anchors = candidates.filter((c) => c.entityType === 'client');
    const fillers = candidates
      .filter((c) => c.entityType === 'prospect' || c.entityType === 'orphan' || c.entityType === 'never' || c.entityType === 'free')
      .filter((c) => {
        if (start && haversineKm(start.lat, start.lng, c.lat, c.lng) <= 60) return true;
        return anchors.some((a) => haversineKm(a.lat, a.lng, c.lat, c.lng) <= 25);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, totalSpace);
    let wi = 0;
    for (const f of fillers) {
      let guard = 0;
      while (guard++ <= starts.length) {
        const spare = capacityPerWeek - weeksDue[wi].length - weekFillers[wi].length;
        if (spare > 0) { weekFillers[wi].push(f); wi = (wi + 1) % starts.length; break; }
        wi = (wi + 1) % starts.length;
      }
    }
  }

  const weeks: MonthWeekBlock[] = starts.map((ws, i) => {
    const members = [...weeksDue[i], ...weekFillers[i]];
    return {
      weekStart: ws,
      label: `${fmtShort(ws)} - ${fmtShort(addDays(ws, 5))}`,
      due: weeksDue[i],
      fillers: weekFillers[i],
      capacity: capacityPerWeek,
      territories: topCities(members),
      overloaded: weeksDue[i].length >= capacityPerWeek,
    };
  });

  const coveredDue = weeks.reduce((s, w) => s + w.due.length, 0);
  return {
    monthRef,
    weeks,
    totalDue: coveredDue + unplaced.length,
    coveredDue,
    laterDue,
    unplaced: unplaced.slice(0, 30),
    capacityPerWeek,
  };
}
