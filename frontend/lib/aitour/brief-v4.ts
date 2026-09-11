// TourBrief V4: contratto "Dillo all'AI" (Fase 1) — normalizzazione, selezione candidati,
// risoluzione clienti nominati LATO CLIENT (l'anagrafica non viene mai inviata al modello).
// L'interpretazione testo→JSON avviene sul backend (/api/ai-tour/parse-brief, prompt V4).
import type { TourCandidate, GeoPoint } from './types';
import type { CandidatePool } from './data';
import { haversineKm, timeToMin } from './types';
import { inBriefArea, provinceCode, type TourAreaConstraint } from './brief-area';
import { normalizeJourney, type BriefJourney } from './brief-journey';

export interface BriefCondition {
  type: string;
  names?: string[];
  match?: 'any' | 'all';
  count?: number;
  operator?: string;
  value?: number;
  radiusKm?: number | null;
  periodDays?: number;
  values?: string[];
}

export type BriefArea = TourAreaConstraint;
export interface BriefPlace {
  source?: 'journey';
  kind: 'home' | 'office' | 'address' | 'customer';
  rawReference: string;
  cityHint?: string | null;
  point?: GeoPoint;
}

export interface BriefAppointment {
  type: 'none' | 'exact' | 'approximate' | 'window';
  time?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface BriefStopRef {
  priority?: number;
  selectedCustomerId?: string;
  areaDecision?: 'include' | 'exclude';
  areaConsent?: string;
  rawReference: string;
  cityHint?: string | null;
  appointment?: BriefAppointment | null;
}

export interface BriefVisitTarget {
  mode: 'exact' | 'approximately' | 'minimum' | 'maximum' | 'range' | 'all' | 'maximize' | 'unspecified';
  value: number | null;
  min: number | null;
  max: number | null;
  scope: 'total_including_mandatory' | 'automatic_plus_mandatory';
}

export interface BriefRoute {
  startPlace?: BriefPlace | null;
  endPlace?: BriefPlace | null;
  compact: 'off' | 'prefer' | 'required';
  startTime: string | null;
  endTime: string | null;
  finishBy: string | null;
  returnHome: boolean;
  returnToStart: boolean;
  splitAllowed: boolean | null;
  maxDays: number | null;
}

export interface TourBriefV4 {
  journey?: BriefJourney | null;
  sourceText?: string;
  includeAutomatic?: boolean;
  version: string;
  dayType: 'clienti' | 'sviluppo' | 'mista' | null;
  requestedDate: { type: 'selected' | 'today' | 'tomorrow' | 'explicit' | 'unspecified'; value: string | null };
  areas: BriefArea[];
  selection: { operator: 'AND' | 'OR'; conditions: BriefCondition[] };
  mandatoryStops: BriefStopRef[];
  preferredStops: BriefStopRef[];
  exclusions: BriefCondition[];
  preferences: { type: string; value?: string }[];
  projectRules: Record<string, unknown>[];
  fillers: Record<string, unknown>[];
  visitTarget: BriefVisitTarget;
  route: BriefRoute;
  interpretation: { confidence: number; needsConfirmation: boolean; unresolvedEntities: string[]; warnings: string[] };
  summary: string;
}

const isTime = (s: unknown): s is string => typeof s === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function normAppointment(a: unknown): BriefAppointment | null {
  if (!a || typeof a !== 'object') return null;
  const r = a as BriefAppointment;
  if (!['exact', 'approximate', 'window'].includes(r.type)) return null;
  return {
    type: r.type,
    time: isTime(r.time) ? r.time : null,
    from: isTime(r.from) ? r.from : null,
    to: isTime(r.to) ? r.to : null,
  };
}

function normStops(list: unknown): BriefStopRef[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      rawReference: typeof s.rawReference === 'string' ? s.rawReference.trim() : '',
      cityHint: typeof s.cityHint === 'string' ? s.cityHint : null,
      appointment: normAppointment(s.appointment),
      priority: typeof s.priority === 'number' && Number.isFinite(s.priority) ? Math.max(1, Math.min(3, Math.round(s.priority))) : 2,
    }))
    .filter((s) => s.rawReference)
    .slice(0, 60);
}

function normPlace(p: unknown): BriefPlace | null {
  if (!p || typeof p !== 'object') return null;
  const r = p as BriefPlace;
  if (!['home', 'office', 'address', 'customer'].includes(r.kind) || typeof r.rawReference !== 'string' || !r.rawReference.trim()) return null;
  return { kind: r.kind, rawReference: r.rawReference.trim(), cityHint: typeof r.cityHint === 'string' ? r.cityHint : null };
}

// Appiattisce gruppi annidati in condizioni piatte (Fase 1: un solo livello logico)
function flattenConditions(list: unknown, depth = 0): BriefCondition[] {
  if (!Array.isArray(list) || depth > 3) return [];
  const out: BriefCondition[] = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    if (Array.isArray(r.conditions)) out.push(...flattenConditions(r.conditions, depth + 1));
    else if (typeof r.type === 'string') out.push(r as unknown as BriefCondition);
  }
  return out.slice(0, 15);
}

export function normalizeBriefV4(raw: Record<string, unknown>): TourBriefV4 {
  const r = raw as Partial<TourBriefV4> & Record<string, unknown>;
  const rd = (r.requestedDate && typeof r.requestedDate === 'object' ? r.requestedDate : {}) as TourBriefV4['requestedDate'];
  const vtRaw = (r.visitTarget && typeof r.visitTarget === 'object' ? r.visitTarget : {}) as BriefVisitTarget;
  const routeRaw = (r.route && typeof r.route === 'object' ? r.route : {}) as Partial<BriefRoute>;
  const interpRaw = (r.interpretation && typeof r.interpretation === 'object' ? r.interpretation : {}) as Partial<TourBriefV4['interpretation']>;
  const num = (x: unknown, max = 200): number | null => (typeof x === 'number' && x > 0 ? Math.min(Math.round(x), max) : null);
  const conditions = flattenConditions((r.selection as { conditions?: unknown } | undefined)?.conditions);
  const areas: BriefArea[] = (Array.isArray(r.areas) ? r.areas : [])
    .filter((a): a is BriefArea => !!a && typeof a === 'object' && ['city', 'province', 'place'].includes((a as BriefArea).kind) && typeof (a as BriefArea).value === 'string' && !!(a as BriefArea).value.trim())
    .map((a) => ({ kind: a.kind, value: a.kind === 'province' ? provinceCode(a.value.trim()) || a.value.trim() : a.value.trim(), mode: ['include', 'exclude', 'prefer'].includes(a.mode) ? a.mode : 'include' }))
    .slice(0, 6);
  return {
    version: '4.0',
    journey: normalizeJourney(r.journey),
    includeAutomatic: typeof r.includeAutomatic === 'boolean' ? r.includeAutomatic : normStops(r.mandatoryStops).length === 0,
    dayType: r.dayType === 'clienti' || r.dayType === 'sviluppo' || r.dayType === 'mista' ? r.dayType : null,
    requestedDate: {
      type: ['selected', 'today', 'tomorrow', 'explicit', 'unspecified'].includes(rd.type) ? rd.type : 'unspecified',
      value: isDate(rd.value) ? rd.value : null,
    },
    areas,
    selection: {
      operator: (r.selection as { operator?: string } | undefined)?.operator === 'OR' ? 'OR' : 'AND',
      conditions: conditions.length > 0 ? conditions : [{ type: 'clients_all' }],
    },
    mandatoryStops: normStops(r.mandatoryStops),
    preferredStops: normStops(r.preferredStops),
    exclusions: flattenConditions(r.exclusions),
    preferences: (Array.isArray(r.preferences) ? r.preferences : [])
      .filter((p): p is { type: string; value?: string } => !!p && typeof p === 'object' && typeof (p as { type?: unknown }).type === 'string')
      .slice(0, 6),
    projectRules: Array.isArray(r.projectRules) ? (r.projectRules as Record<string, unknown>[]) : [],
    fillers: Array.isArray(r.fillers) ? (r.fillers as Record<string, unknown>[]) : [],
    visitTarget: {
      mode: ['exact', 'approximately', 'minimum', 'maximum', 'range', 'all', 'maximize', 'unspecified'].includes(vtRaw.mode) ? vtRaw.mode : 'unspecified',
      value: num(vtRaw.value, 60),
      min: num(vtRaw.min, 60),
      max: num(vtRaw.max, 60),
      scope: vtRaw.scope === 'automatic_plus_mandatory' ? 'automatic_plus_mandatory' : 'total_including_mandatory',
    },
    route: {
      startPlace: normPlace(routeRaw.startPlace),
      endPlace: normPlace(routeRaw.endPlace),
      compact: routeRaw.compact === 'prefer' || routeRaw.compact === 'required' ? routeRaw.compact : 'off',
      startTime: isTime(routeRaw.startTime) ? routeRaw.startTime : null,
      endTime: isTime(routeRaw.endTime) ? routeRaw.endTime : null,
      finishBy: isTime(routeRaw.finishBy) ? routeRaw.finishBy : null,
      returnHome: routeRaw.returnHome === true,
      returnToStart: routeRaw.returnToStart === true,
      splitAllowed: routeRaw.splitAllowed === true ? true : routeRaw.splitAllowed === false ? false : null,
      maxDays: num(routeRaw.maxDays, 6),
    },
    interpretation: {
      confidence: typeof interpRaw.confidence === 'number' ? Math.max(0, Math.min(1, interpRaw.confidence)) : 1,
      needsConfirmation: interpRaw.needsConfirmation === true,
      unresolvedEntities: (Array.isArray(interpRaw.unresolvedEntities) ? interpRaw.unresolvedEntities : []).filter((x): x is string => typeof x === 'string').slice(0, 8),
      warnings: (Array.isArray(interpRaw.warnings) ? interpRaw.warnings : []).filter((x): x is string => typeof x === 'string').slice(0, 8),
    },
    summary: typeof r.summary === 'string' ? r.summary : '',
  };
}

// Fallback regex lato client: "tornando a casa / rientro alla base" non colto dal modello
export function applyReturnHomeFallback(brief: TourBriefV4, text: string): TourBriefV4 {
  if (!brief.route.returnHome && !brief.route.returnToStart &&
    /(torn\w*|rientr\w*)\s+(a\s+casa|verso\s+casa|al\s+punto\s+di\s+partenza|alla\s+base)|finisc\w*\s+a\s+casa/i.test(text)) {
    brief.route.returnHome = true;
  }
  return brief;
}

// ---------- SELEZIONE CANDIDATI ----------

const dedup = (list: TourCandidate[]): TourCandidate[] => {
  const seen = new Set<string>();
  return list.filter((c) => { if (seen.has(c.key)) return false; seen.add(c.key); return true; });
};

const matchProject = (c: TourCandidate, names: string[]): boolean =>
  names.some((n) => {
    const q = n.trim().toLowerCase();
    return !!q && ((c.projectName || '').toLowerCase().includes(q) || (c.projectType || '').toLowerCase().includes(q));
  });

const SOURCE_TYPES = new Set(['clients_all', 'clients_frequent', 'clients_top', 'project_membership', 'project', 'orphans', 'prospects']);

function sourceList(cond: BriefCondition, pool: CandidatePool, anchors: TourCandidate[]): TourCandidate[] {
  switch (cond.type) {
    case 'clients_all': return pool.clients;
    case 'clients_frequent': return pool.clients.filter((c) => (c.avgReorderDays != null && c.avgReorderDays <= 40) || c.orderCount >= 6);
    case 'clients_top': {
      const top = [...pool.clients].sort((a, b) => b.revenue6m - a.revenue6m).slice(0, cond.count && cond.count > 0 ? cond.count : 5);
      anchors.push(...top);
      return top;
    }
    case 'project_membership':
    case 'project': {
      const names = Array.isArray(cond.names) ? cond.names : (cond as { name?: string }).name ? [(cond as { name?: string }).name as string] : [];
      if (names.length === 0) return [];
      return [...pool.clients, ...pool.prospects].filter((c) => matchProject(c, names));
    }
    case 'orphans': {
      const list = [...pool.orphans].sort((a, b) => b.score - a.score);
      return cond.count && cond.count > 0 ? list.slice(0, cond.count) : list;
    }
    case 'prospects': return [...pool.prospects, ...(pool.registry || [])];
    default: return [];
  }
}

function numericFilter(cond: BriefCondition): ((c: TourCandidate) => boolean) | null {
  const cmp = (v: number | null, op: string, x: number): boolean => {
    if (v == null) return false;
    if (op === '>=') return v >= x;
    if (op === '>') return v > x;
    if (op === '<=') return v <= x;
    if (op === '<') return v < x;
    return v === x;
  };
  const op = cond.operator || '>=';
  const val = cond.value;
  if (val == null) return null;
  if (cond.type === 'last_order_days' || cond.type === 'clients_overdue') return (c) => cmp(c.daysSinceOrder, op, cond.type === 'clients_overdue' ? ((cond as { minDays?: number }).minDays ?? val) : val);
  if (cond.type === 'last_visit_days') return (c) => cmp(c.daysSinceVisit, op, val);
  if (cond.type === 'revenue') return (c) => cmp(c.totalRevenue, op, val);
  if (cond.type === 'orders_count') return (c) => cmp(c.orderCount, op, val);
  return null;
}

export interface SelectionV4 {
  candidates: TourCandidate[];
  anchors: TourCandidate[];
  newAround: { radiusKm: number } | null;
  warnings: string[];
}

export function selectCandidatesV4(brief: TourBriefV4, pool: CandidatePool): SelectionV4 {
  pool = { ...pool, clients: pool.clients.filter((c) => inBriefArea(c, brief.areas, brief.journey)), prospects: pool.prospects.filter((c) => inBriefArea(c, brief.areas, brief.journey)), orphans: pool.orphans.filter((c) => inBriefArea(c, brief.areas, brief.journey)), registry: pool.registry?.filter((c) => inBriefArea(c, brief.areas, brief.journey)) };
  const warnings: string[] = [];
  const anchors: TourCandidate[] = [];
  let newAround: { radiusKm: number } | null = null;
  const sources: TourCandidate[] = [];
  const filters: ((c: TourCandidate) => boolean)[] = [];
  let hasSource = false;
  for (const cond of brief.selection.conditions) {
    if (cond.type === 'new_around') {
      newAround = { radiusKm: cond.radiusKm && cond.radiusKm > 0 ? Math.min(cond.radiusKm, 30) : 5 };
      continue;
    }
    if (SOURCE_TYPES.has(cond.type)) {
      hasSource = true;
      if ((cond.type === 'project_membership' || cond.type === 'project') && cond.match === 'all') {
        warnings.push('Appartenenza a TUTTI i progetti insieme non ancora supportata: considerata come "almeno uno"');
      }
      sources.push(...sourceList(cond, pool, anchors));
      continue;
    }
    const f = numericFilter(cond);
    if (f) filters.push(f);
    else warnings.push(`Criterio "${cond.type}" non ancora supportato: ignorato`);
  }
  const development = [...pool.prospects, ...pool.orphans, ...(pool.registry || [])];
  let base = hasSource ? dedup(sources) : brief.dayType === 'sviluppo' ? development : brief.dayType === 'mista' ? [...pool.clients, ...development] : [...pool.clients];
  if (filters.length > 0) {
    if (brief.selection.operator === 'OR') {
      const extra = pool.clients.filter((c) => filters.some((f) => f(c)));
      base = dedup([...base, ...extra]);
    } else {
      base = base.filter((c) => filters.every((f) => f(c)));
    }
  }
  // Esclusioni obbligatorie
  for (const ex of brief.exclusions) {
    if (ex.type === 'prospects') base = base.filter((c) => !['prospect', 'free', 'never'].includes(c.entityType));
    else if (ex.type === 'orphans') base = base.filter((c) => c.entityType !== 'orphan');
    else if (ex.type === 'project_membership' || ex.type === 'project') {
      const names = Array.isArray(ex.names) ? ex.names : (ex as { name?: string }).name ? [(ex as { name?: string }).name as string] : [];
      if (names.length > 0) base = base.filter((c) => !matchProject(c, names));
    } else {
      const f = numericFilter(ex);
      if (f) base = base.filter((c) => !f(c));
      else warnings.push(`Esclusione "${ex.type}" non ancora supportata: ignorata`);
    }
  }
  // Preferenze: boost punteggio (non filtrano)
  const boosted = base.map((c) => {
    let bonus = 0;
    for (const p of brief.preferences) {
      if (p.type === 'prefer_oldest_last_order' && c.daysSinceOrder != null) bonus += Math.min(30, c.daysSinceOrder / 3);
      else if (p.type === 'prefer_oldest_last_visit' && c.daysSinceVisit != null) bonus += Math.min(30, c.daysSinceVisit / 3);
      else if (p.type === 'prefer_highest_revenue') bonus += Math.min(20, c.revenue6m / 500);
      else if (p.type === 'prefer_area' && p.value && (c.city || '').toLowerCase() === p.value.toLowerCase()) bonus += 15;
    }
    return bonus > 0 ? { ...c, score: c.score + Math.round(bonus) } : c;
  });
  if (brief.projectRules.length > 0) warnings.push('Quote/priorità tra progetti: verranno applicate in una prossima versione');
  if (brief.fillers.length > 0) warnings.push('Visite "se avanza tempo" (riempitivi): verranno applicate in una prossima versione');
  return { candidates: boosted, anchors: anchors.length > 0 ? dedup(anchors) : boosted, newAround, warnings };
}

export function withinRadiusOfAnchors(list: TourCandidate[], anchors: TourCandidate[], radiusKm: number): TourCandidate[] {
  if (anchors.length === 0) return list;
  return list.filter((c) => anchors.some((a) => haversineKm(a.lat, a.lng, c.lat, c.lng) <= radiusKm));
}

// ---------- RISOLUZIONE CLIENTI NOMINATI (lato client, fuzzy) ----------

const STOPWORDS = new Set(['di', 'da', 'del', 'della', 'il', 'la', 'lo', 'le', 'quello', 'quella', 'tabaccheria', 'tabacchi', 'bar', 'edicola', 'rivendita', 'signor', 'sig']);
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tokens = (s: string): string[] => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));

export interface ResolvedStop {
  ref: BriefStopRef;
  status: 'resolved' | 'ambiguous' | 'unresolved';
  candidate: TourCandidate | null;
  options: TourCandidate[];
}

export function resolveStopRefs(refs: BriefStopRef[], all: TourCandidate[]): ResolvedStop[] {
  return refs.map((ref) => {
    const q = tokens(`${ref.rawReference} ${ref.cityHint || ''}`);
    if (q.length === 0) return { ref, status: 'unresolved' as const, candidate: null, options: [] };
    const scored = all
      .map((c) => {
        const hayName = norm(`${c.name} ${c.crmName || ''}`);
        const hayCity = norm(c.city || '');
        const hayAddr = norm(c.address || '');
        let s = 0;
        for (const t of q) {
          if (hayName.includes(t)) s += 3;
          else if (hayCity.includes(t)) s += 2;
          else if (hayAddr.includes(t)) s += 1;
        }
        return { c, s };
      })
      .filter((x) => x.s >= 3)
      .sort((a, b) => b.s - a.s);
    if (scored.length === 0) return { ref, status: 'unresolved' as const, candidate: null, options: [] };
    const best = scored[0];
    const second = scored[1];
    if (!second || best.s >= second.s + 2 || second.c.customerId === best.c.customerId) {
      return { ref, status: 'resolved' as const, candidate: best.c, options: scored.slice(0, 3).map((x) => x.c) };
    }
    return { ref, status: 'ambiguous' as const, candidate: null, options: scored.slice(0, 3).map((x) => x.c) };
  });
}

// Applica l'appuntamento come fascia oraria del candidato (il planner rispetta le fasce)
export function applyAppointment(c: TourCandidate, appt: BriefAppointment | null | undefined): TourCandidate {
  if (!appt || appt.type === 'none') return c;
  let start: number | null = null;
  let end: number | null = null;
  let strict = false;
  if (appt.type === 'exact' && appt.time) { start = timeToMin(appt.time) - 5; end = timeToMin(appt.time) + 15; strict = true; }
  else if (appt.type === 'approximate' && appt.time) { start = timeToMin(appt.time) - 45; end = timeToMin(appt.time) + 45; }
  else if (appt.type === 'window' && appt.from && appt.to) { start = timeToMin(appt.from); end = timeToMin(appt.to); strict = true; }
  if (start == null || end == null || end <= start) return c;
  return { ...c, preferredSlots: [{ id: 'appt', label: `appuntamento ${appt.time || `${appt.from}-${appt.to}`}`, start, end, strict }] };
}

// Cap sul numero di visite dal visitTarget (null = nessun limite)
export function targetCap(vt: BriefVisitTarget): number | null {
  if (vt.mode === 'exact' || vt.mode === 'approximately') return vt.value;
  if (vt.mode === 'maximum') return vt.value ?? vt.max;
  if (vt.mode === 'range') return vt.max ?? vt.value;
  return null;
}

// ---------- ETICHETTE UI ----------

export function conditionLabel(c: BriefCondition): string {
  switch (c.type) {
    case 'clients_all': return 'Tutti i clienti';
    case 'clients_frequent': return 'Clienti che ordinano spesso';
    case 'clients_top': return `Top ${c.count || 5} clienti`;
    case 'project_membership':
    case 'project': {
      const names = Array.isArray(c.names) ? c.names : [(c as { name?: string }).name].filter(Boolean);
      return `Progetti: ${names.join(', ')}`;
    }
    case 'orphans': return c.count ? `Orfani (${c.count})` : 'Orfani';
    case 'prospects': return 'Prospect';
    case 'new_around': return `Nuovi entro ${c.radiusKm || 5} km`;
    case 'last_order_days':
    case 'clients_overdue': return `Non ordinano da ${c.operator === '<=' || c.operator === '<' ? 'meno di' : 'almeno'} ${c.value ?? (c as { minDays?: number }).minDays ?? 30} gg`;
    case 'last_visit_days': return `Non visitati da ${c.operator === '<=' || c.operator === '<' ? 'meno di' : 'almeno'} ${c.value ?? 30} gg`;
    case 'revenue': return `Fatturato ${c.operator || '>='} ${c.value}€`;
    case 'orders_count': return `Ordini ${c.operator || '>='} ${c.value}`;
    default: return c.type;
  }
}

export function preferenceLabel(p: { type: string; value?: string }): string {
  switch (p.type) {
    case 'prefer_oldest_last_order': return 'Prima i più fermi (ordini)';
    case 'prefer_oldest_last_visit': return 'Prima i non visitati da più tempo';
    case 'prefer_highest_revenue': return 'Prima i più importanti';
    case 'prefer_nearest': return 'Prima i più comodi';
    case 'prefer_area': return `Preferisci zona ${p.value || ''}`.trim();
    default: return p.type;
  }
}

export function targetLabel(vt: BriefVisitTarget): string {
  switch (vt.mode) {
    case 'exact': return `${vt.value} visite`;
    case 'approximately': return `~${vt.value} visite`;
    case 'maximum': return `max ${vt.value ?? vt.max} visite`;
    case 'minimum': return `almeno ${vt.value ?? vt.min} visite`;
    case 'range': return `${vt.min}-${vt.max} visite`;
    case 'all': return 'Tutte';
    case 'maximize': return 'Il massimo possibile';
    default: return 'Auto';
  }
}

export function dateChipLabel(rd: TourBriefV4['requestedDate']): string {
  if (rd.type === 'today') return 'Oggi';
  if (rd.type === 'tomorrow') return rd.value ? `Domani (${rd.value.slice(8, 10)}/${rd.value.slice(5, 7)})` : 'Domani';
  if ((rd.type === 'explicit' || rd.type === 'selected') && rd.value) return `${rd.value.slice(8, 10)}/${rd.value.slice(5, 7)}/${rd.value.slice(0, 4)}`;
  return 'Oggi';
}
