// "Dillo all'AI": trasforma un brief in linguaggio naturale (interpretato dal backend)
// in un giro concreto, riusando il planner esistente. Gestisce segmenti, area,
// compattezza, numero tappe target e suddivisione su 2 giorni.
import type { CandidatePool } from './data';
import { loadFreeTabaccherie } from './data';
import { scoreCandidates } from './scoring';
import { planTour, pickBestCluster, filterByArea, type AreaFilter } from './planner';
import { geocodeAddress } from './osrm';
import type { TourCandidate, TourPlan, GeoPoint, AiTourSettings, DayType } from './types';
import { haversineKm } from './types';

export type BriefSegment =
  | { type: 'clients_all' }
  | { type: 'clients_frequent' }
  | { type: 'clients_overdue'; minDays?: number }
  | { type: 'clients_top'; count?: number }
  | { type: 'project'; name?: string }
  | { type: 'orphans'; count?: number }
  | { type: 'prospects' }
  | { type: 'new_around'; radiusKm?: number };

export interface TourBrief {
  dayType: Exclude<DayType, 'ai'> | null;
  area: { kind: 'city' | 'province' | 'place' | 'none'; value: string | null };
  segments: BriefSegment[];
  targetCount: number | null;
  compact: boolean;
  splitDays: 1 | 2;
  startTime: string | null;
  endTime: string | null;
  mandatoryAll: boolean;
  summary: string;
  dayOffset: number;
}

const norm = (s: string | null | undefined): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Coercizione robusta della risposta del modello (campi mancanti / tipi errati)
export function normalizeBrief(raw: unknown): TourBrief {
  const r = (raw || {}) as Record<string, unknown>;
  const dtRaw = String(r.dayType || '').toLowerCase();
  const dayType = (['clienti', 'sviluppo', 'mista'].includes(dtRaw) ? dtRaw : null) as Exclude<DayType, 'ai'> | null;
  const areaRaw = (r.area || {}) as Record<string, unknown>;
  const kindRaw = String(areaRaw.kind || 'none').toLowerCase();
  const kind = (['city', 'province', 'place', 'none'].includes(kindRaw) ? kindRaw : 'none') as TourBrief['area']['kind'];
  const value = areaRaw.value != null && String(areaRaw.value).trim() ? String(areaRaw.value).trim() : null;
  const segsRaw = Array.isArray(r.segments) ? r.segments : [];
  const segments: BriefSegment[] = [];
  for (const s of segsRaw) {
    const seg = (s || {}) as Record<string, unknown>;
    const t = String(seg.type || '');
    if (t === 'clients_all') segments.push({ type: 'clients_all' });
    else if (t === 'clients_frequent') segments.push({ type: 'clients_frequent' });
    else if (t === 'clients_overdue') segments.push({ type: 'clients_overdue', minDays: Number(seg.minDays) || 30 });
    else if (t === 'clients_top') segments.push({ type: 'clients_top', count: Number(seg.count) || 5 });
    else if (t === 'project') segments.push({ type: 'project', name: seg.name ? String(seg.name) : undefined });
    else if (t === 'orphans') segments.push({ type: 'orphans', count: seg.count ? Number(seg.count) : undefined });
    else if (t === 'prospects') segments.push({ type: 'prospects' });
    else if (t === 'new_around') segments.push({ type: 'new_around', radiusKm: Math.min(30, Number(seg.radiusKm) || 5) });
  }
  const timeOk = (v: unknown): string | null => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v : null);
  return {
    dayType,
    area: { kind, value: kind === 'none' ? null : value },
    segments: (segments.length > 0 ? segments : [{ type: 'clients_all' } as BriefSegment]).slice(0, 10),
    targetCount: r.targetCount != null && Number(r.targetCount) > 0 ? Math.min(60, Math.round(Number(r.targetCount))) : null,
    compact: r.compact === true,
    splitDays: Number(r.splitDays) === 2 ? 2 : 1,
    startTime: timeOk(r.startTime),
    endTime: timeOk(r.endTime),
    mandatoryAll: r.mandatoryAll === true,
    summary: r.summary ? String(r.summary) : '',
    dayOffset: r.dayOffset != null && Number(r.dayOffset) > 0 ? Math.min(14, Math.round(Number(r.dayOffset))) : 0,
  };
}

// Etichette leggibili dei segmenti (per i chip di conferma)
export function segmentLabel(s: BriefSegment): string {
  switch (s.type) {
    case 'clients_all': return 'Tutti i clienti';
    case 'clients_frequent': return 'Clienti che ordinano spesso';
    case 'clients_overdue': return `Non ordinano da ${s.minDays ?? 30}+ gg`;
    case 'clients_top': return `Migliori ${s.count ?? 5} clienti`;
    case 'project': return `Insegna: ${s.name || '—'}`;
    case 'orphans': return s.count ? `${s.count} orfani da recuperare` : 'Clienti orfani';
    case 'prospects': return 'Prospect';
    case 'new_around': return `Nuovi da acquisire (~${s.radiusKm ?? 5} km)`;
  }
}

function inferDayType(brief: TourBrief): Exclude<DayType, 'ai'> {
  if (brief.dayType) return brief.dayType;
  const types = brief.segments.map((s) => s.type);
  const hasDev = types.some((t) => t === 'orphans' || t === 'prospects' || t === 'new_around');
  const hasClients = types.some((t) => t.startsWith('clients') || t === 'project');
  if (hasDev && hasClients) return 'mista';
  if (hasDev) return 'sviluppo';
  return 'clienti';
}

// Applica i segmenti al pool (già caricato e con score) → insieme candidati di base + ancore
function resolveSegments(pool: CandidatePool, brief: TourBrief): { base: TourCandidate[]; anchors: TourCandidate[]; newAroundKm: number | null } {
  const byKey = new Map<string, TourCandidate>();
  const add = (c: TourCandidate) => { if (!byKey.has(c.key)) byKey.set(c.key, c); };
  let anchors: TourCandidate[] = [];
  let newAroundKm: number | null = null;

  const matchProject = (c: TourCandidate, name: string): boolean => {
    const n = norm(name);
    if (!n) return false;
    return norm(c.projectName).includes(n) || norm(c.projectType).includes(n) || n.includes(norm(c.projectName));
  };

  for (const s of brief.segments) {
    if (s.type === 'clients_all') pool.clients.forEach(add);
    else if (s.type === 'clients_frequent') {
      pool.clients
        .filter((c) => (c.avgReorderDays != null && c.avgReorderDays <= 40) || c.orderCount >= 6)
        .forEach(add);
    } else if (s.type === 'clients_overdue') {
      const min = s.minDays ?? 30;
      pool.clients.filter((c) => c.daysSinceOrder != null && c.daysSinceOrder >= min).forEach(add);
    } else if (s.type === 'clients_top') {
      const n = s.count ?? 5;
      const top = [...pool.clients]
        .sort((a, b) => (b.revenue6m - a.revenue6m) || (b.totalRevenue - a.totalRevenue) || (b.score - a.score))
        .slice(0, n);
      top.forEach(add);
      anchors = [...anchors, ...top];
    } else if (s.type === 'project') {
      if (s.name) [...pool.clients, ...pool.prospects].filter((c) => matchProject(c, s.name!)).forEach(add);
    } else if (s.type === 'orphans') {
      const list = [...pool.orphans].sort((a, b) => b.score - a.score);
      (s.count && s.count > 0 ? list.slice(0, s.count) : list).forEach(add);
    } else if (s.type === 'prospects') {
      pool.prospects.forEach(add);
    } else if (s.type === 'new_around') {
      newAroundKm = s.radiusKm ?? 5;
    }
  }
  return { base: [...byKey.values()], anchors, newAroundKm };
}

function areaFilterFor(brief: TourBrief): AreaFilter | null {
  if (brief.area.kind === 'city' && brief.area.value) return { mode: 'city', city: brief.area.value };
  if (brief.area.kind === 'province' && brief.area.value) return { mode: 'province', province: brief.area.value };
  return null;
}

export interface BriefPlanParams {
  pool: CandidatePool;
  brief: TourBrief;
  settings: AiTourSettings;
  agentId: string;
  start: GeoPoint;
  end: GeoPoint | null;
  tourDate: string;
  nextDate: string;
  startMin: number;
  endMin: number;
}

export interface BriefPlanResult {
  plan: TourPlan;
  secondary: TourPlan | null;
  areaLabel: string;
  resolvedDayType: Exclude<DayType, 'ai'>;
  note: string;
  /** Soggetti selezionati ma NON entrati nei giorni pianificati (per proporre più giornate) */
  leftover: TourCandidate[];
  bufferPct: number;
}

// Costruisce uno (o due) giri a partire dal brief interpretato.
export async function buildBriefPlan(p: BriefPlanParams): Promise<BriefPlanResult> {
  const { pool, brief, settings, agentId, start, end } = p;
  const resolvedDayType = inferDayType(brief);
  const notes: string[] = [];

  // 1) Segmenti → candidati di base
  let { base, anchors, newAroundKm } = resolveSegments(pool, brief);
  if (base.length === 0 && newAroundKm == null) {
    // Nessun segmento riconosciuto: ripiego sul tipo giornata
    base = resolvedDayType === 'clienti' ? [...pool.clients]
      : resolvedDayType === 'sviluppo' ? [...pool.prospects, ...pool.orphans]
      : [...pool.clients, ...pool.prospects, ...pool.orphans];
  }

  // 2) Area
  let areaLabel = '';
  let placeCenter: GeoPoint | null = null;
  const af = areaFilterFor(brief);
  if (af) {
    base = filterByArea(base, af, start);
    areaLabel = brief.area.value || '';
  } else if (brief.area.kind === 'place' && brief.area.value) {
    const g = await geocodeAddress(brief.area.value);
    if (g) {
      placeCenter = { lat: g.lat, lng: g.lng, label: brief.area.value };
      const R = 30;
      base = base.filter((c) => haversineKm(g.lat, g.lng, c.lat, c.lng) <= R);
      areaLabel = brief.area.value;
    } else {
      notes.push(`Non ho trovato la zona "${brief.area.value}": uso l'intera area disponibile`);
    }
  }

  // 3) Ancore per "clienti nuovi intorno": se non ci sono top espliciti, uso l'intera base
  if (anchors.length === 0) anchors = base;

  // 4) Nuovi da acquisire intorno alle ancore (tabaccherie libere + prospect/orfani vicini)
  if (newAroundKm != null && anchors.length > 0) {
    const R = newAroundKm;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const a of anchors) {
      minLat = Math.min(minLat, a.lat); maxLat = Math.max(maxLat, a.lat);
      minLng = Math.min(minLng, a.lng); maxLng = Math.max(maxLng, a.lng);
    }
    const pad = R / 111 + 0.02;
    const bounds = { minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad, maxLng: maxLng + pad };
    const near = (c: { lat: number; lng: number }) => anchors.some((a) => haversineKm(a.lat, a.lng, c.lat, c.lng) <= R);
    const baseKeys = new Set(base.map((c) => c.key));
    // prospect/orfani del portafoglio vicini alle ancore
    for (const c of [...pool.prospects, ...pool.orphans]) if (!baseKeys.has(c.key) && near(c)) { base.push(c); baseKeys.add(c.key); }
    try {
      const exclude = new Set(base.map((c) => c.tabaccheriaId).filter((x): x is string => !!x));
      const free = await loadFreeTabaccherie(bounds, exclude, settings, { refLat: (minLat + maxLat) / 2, refLng: (minLng + maxLng) / 2, agentId }, 60);
      const freeNear = free.filter((c) => near(c));
      if (freeNear.length > 0) { scoreCandidates(freeNear, settings); for (const c of freeNear) if (!baseKeys.has(c.key)) { base.push(c); baseKeys.add(c.key); } }
    } catch (err) {
      console.warn('[brief] new_around free tabaccherie:', err);
    }
    notes.push(`Aggiunti punti vendita nuovi entro ${R} km dai clienti selezionati`);
  }

  // 5) Compattezza: un unico cluster geografico
  if (brief.compact && base.length > 3) {
    const clusterStart = placeCenter || start;
    const cluster = pickBestCluster(base, clusterStart);
    if (cluster.list.length >= 1) {
      base = cluster.list;
      if (!areaLabel && cluster.label) areaLabel = cluster.label;
      notes.push('Tappe accorpate in un\'unica zona compatta');
    }
  }

  // 6) Numero tappe target: taglia sui punteggi più alti
  const target = brief.targetCount;
  if (target != null && base.length > target) {
    base = [...base].sort((a, b) => b.score - a.score).slice(0, target);
    notes.push(`Limitato alle ${target} tappe più rilevanti`);
  }

  // 7) Obbligatorie: "tutti i clienti X" in un solo giorno → tutte obbligatorie.
  //    Se è previsto lo split su 2 giorni non forzo (lascio che il planner distribuisca).
  const forceAll = brief.mandatoryAll && brief.splitDays === 1;
  const mandatoryKeys = new Set<string>(forceAll ? base.map((c) => c.key) : []);

  const bufferPct = resolvedDayType === 'clienti' ? settings.buffer_pct_clienti
    : resolvedDayType === 'sviluppo' ? settings.buffer_pct_sviluppo : settings.buffer_pct_mista;

  const planArgs = {
    mandatoryKeys,
    start,
    end,
    startMin: p.startMin,
    endMin: p.endMin,
    dayType: resolvedDayType as DayType,
    resolvedDayType,
    bufferPct,
    bufferMaxMin: settings.buffer_max_min,
    area: { mode: 'auto' as const },
  };

  // Giorno 1
  const plan = await planTour({ ...planArgs, candidates: base, tourDate: p.tourDate });
  plan.areaLabel = areaLabel;

  // Giorno 2 (facoltativo): i soggetti non entrati nel giorno 1
  let secondary: TourPlan | null = null;
  if (brief.splitDays === 2) {
    const day1Keys = new Set(plan.stops.map((s) => s.candidate.key));
    const leftover = base.filter((c) => !day1Keys.has(c.key));
    if (leftover.length > 0) {
      secondary = await planTour({ ...planArgs, mandatoryKeys: new Set<string>(), candidates: leftover, tourDate: p.nextDate });
      secondary.areaLabel = areaLabel;
      notes.push(`Non entrava in un giorno: ${plan.stops.length} tappe oggi, ${secondary.stops.length} tappe nel giorno successivo`);
    } else {
      notes.push('Tutte le tappe entrano in un solo giorno');
    }
  }

  // Soggetti rimasti fuori da tutti i giorni pianificati
  const doneKeys = new Set(plan.stops.map((s) => s.candidate.key));
  if (secondary) for (const s of secondary.stops) doneKeys.add(s.candidate.key);
  const leftover = base.filter((c) => !doneKeys.has(c.key));

  return { plan, secondary, areaLabel, resolvedDayType, note: notes.join('. '), leftover, bufferPct };
}
