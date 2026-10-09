// Contract ported from voom/main 88bfb44. No second natural-language interpreter.
import type { EntityType } from './types';

export interface TourIntentArea { comune?: string | null; comuni?: string[] | null; zona?: string | null; provincia?: string | null }
export interface FollowUpDecision {
  followUpId: string; key: string; customerName: string; originalDate: string;
  currentDate: string; currentTime: string | null;
  decision: 'required' | 'excluded' | 'rescheduled';
}
export interface TourIntent {
  requestedEntityTypes: EntityType[]; physicalContactMinDays: number | null; orderMinDays: number | null;
  minRevenue: number | null; maxRevenue: number | null; project: string | null;
  requestedArea: TourIntentArea | null; requiredStops: string[]; excludedStops: string[];
  allowedExpansionTypes: EntityType[]; allowLargeBuffer: boolean; rejectedOpportunityKeys: string[];
  tourDates: string[]; followUpDecisions: FollowUpDecision[];
  lodgingRule: { mode: 'conditional'; maxKmHome: number } | null;
  wantAll: boolean; maxDays: number | null; ownOrphansOnly: boolean;
  // Web 874ba31/30b163a — vincoli deterministici del client (regole conversazionali), MAI accettati dal modello:
  /** "Non comprano da N giorni": serve un ordine reale, mai visite o nuovi punti al posto degli acquisti. */
  requireOrderHistory?: boolean;
  allTobacconists?: boolean;
  acceptedPartialAreas?: string[];
  singleDayRequested?: boolean;
  extraDaysApproved?: boolean;
  requestedStartTime?: string;
  requestedEndTime?: string;
  strictGeography?: boolean;
  allowNearby?: boolean;
  skipFollowUps?: boolean;
}
export const DEFAULT_INTENT: TourIntent = {
  requestedEntityTypes: [], physicalContactMinDays: null, orderMinDays: null,
  minRevenue: null, maxRevenue: null, project: null, requestedArea: null,
  requiredStops: [], excludedStops: [], allowedExpansionTypes: [], allowLargeBuffer: false,
  rejectedOpportunityKeys: [], tourDates: [], followUpDecisions: [], lodgingRule: null,
  wantAll: false, maxDays: null, ownOrphansOnly: false,
};
const TYPES = ['client', 'prospect', 'orphan', 'free', 'never'];
const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && !!s.trim()))] : [];
export function sanitizeIntentPatch(raw: unknown): Partial<TourIntent> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>, p: Partial<TourIntent> = {};
  for (const k of ['requestedEntityTypes', 'allowedExpansionTypes'] as const)
    if (k in r) p[k] = strings(r[k]).filter((s) => TYPES.includes(s)) as EntityType[];
  for (const k of ['requiredStops', 'excludedStops', 'rejectedOpportunityKeys', 'tourDates'] as const)
    if (k in r) p[k] = strings(r[k]);
  for (const k of ['physicalContactMinDays', 'orderMinDays', 'minRevenue', 'maxRevenue', 'maxDays'] as const) {
    if (!(k in r) || r[k] === undefined) continue;
    if (r[k] === null || r[k] === '') { p[k] = null; continue; }
    const n = Number(r[k]);
    if (Number.isFinite(n) && n >= 0) p[k] = k === 'maxDays' ? (n >= 1 ? Math.floor(n) : null) : n;
  }
  for (const k of ['ownOrphansOnly', 'wantAll', 'allowLargeBuffer'] as const)
    if (typeof r[k] === 'boolean') p[k] = r[k];
  if ('project' in r && (r.project === null || typeof r.project === 'string')) p.project = r.project?.trim() || null;
  if (r.requestedArea === null) p.requestedArea = null;
  else if (r.requestedArea && typeof r.requestedArea === 'object') {
    p.requestedArea = {};
    const a = r.requestedArea as Record<string, unknown>;
    for (const k of ['comune', 'provincia', 'zona'] as const)
      if (k in a && (a[k] === null || typeof a[k] === 'string')) p.requestedArea[k] = a[k] as string | null;
    const legacy = typeof a.comune === 'string' && a.comune.trim() ? [a.comune] : [];
    const comuni = [...new Set([...strings(a.comuni), ...legacy].map((s) => s.trim()).filter(Boolean))];
    if (comuni.length) { p.requestedArea.comuni = comuni; p.requestedArea.comune = comuni[0]; }
  }
  if ('lodgingRule' in r) {
    const v = r.lodgingRule as Record<string, unknown> | null;
    if (v === null) p.lodgingRule = null;
    else if (v?.mode === 'conditional' && Number(v.maxKmHome) > 0)
      p.lodgingRule = { mode: 'conditional', maxKmHome: Number(v.maxKmHome) };
  }
  // CRM decisions are never accepted from an unverified LLM intent patch.
  return p;
}
export function mergeFollowUpDecisions(prev: FollowUpDecision[], add: FollowUpDecision[]): FollowUpDecision[] {
  const m = new Map(prev.map((d) => [d.followUpId, d]));
  add.forEach((d) => m.set(d.followUpId, d)); return [...m.values()];
}
function mergeArea(prev: TourIntentArea | null, patch: TourIntentArea): TourIntentArea {
  const prevComuni = prev?.comuni?.length ? prev.comuni : (prev?.comune ? [prev.comune] : []);
  const patchComuni = patch.comuni?.length ? patch.comuni : (patch.comune ? [patch.comune] : []);
  const comuni = [...new Set([...prevComuni, ...patchComuni])];
  return { ...prev, ...patch, comuni, comune: comuni[0] ?? patch.comune ?? prev?.comune ?? null };
}
export function mergeIntent(prev: TourIntent, patch?: Partial<TourIntent> | null): TourIntent {
  if (!patch) return prev;
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return { ...prev, ...defined,
    requestedArea: patch.requestedArea === null ? null : patch.requestedArea ? mergeArea(prev.requestedArea, patch.requestedArea) : prev.requestedArea,
    rejectedOpportunityKeys: [...new Set([...prev.rejectedOpportunityKeys, ...(patch.rejectedOpportunityKeys || [])])],
    allowLargeBuffer: prev.allowLargeBuffer || !!patch.allowLargeBuffer,
    followUpDecisions: mergeFollowUpDecisions(prev.followUpDecisions, patch.followUpDecisions || []),
  };
}
export function applyRejection(intent: TourIntent, keys: string[]): TourIntent {
  return mergeIntent(intent, { rejectedOpportunityKeys: keys, allowLargeBuffer: true });
}
export function requiredDatedStopsOf(intent: TourIntent) {
  return intent.followUpDecisions.filter((d) => d.decision !== 'excluded')
    .map((d) => ({ key: d.key, date: d.currentDate, source: 'follow_up' as const, sourceId: d.followUpId }));
}