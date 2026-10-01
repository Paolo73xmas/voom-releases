import type { EntityType, TourCandidate } from './types';
import type { TourIntent } from './gptour-intent';
import { normalizeGptourName as norm } from './gptour-identity';
import { provinceCode } from './brief-area';
export type IntentMatchMode = 'initial' | 'fill' | 'corridor';
export const DEFAULT_FILL_CONTACT_DAYS = 15;
/** Web 88bfb44: fill without explicit expansions uses the progressive ranking.
 * Initial AI selections and corridor remain constrained to requested + allowed types. */
export function allowedTypesFor(intent: TourIntent, mode: IntentMatchMode): Set<EntityType> | null {
  const requested = intent.requestedEntityTypes, expansion = intent.allowedExpansionTypes;
  if (requested.length === 0 && expansion.length === 0) return null;
  if (mode === 'fill' && expansion.length === 0) return null;
  return new Set<EntityType>([...requested, ...expansion]);
}
export function candidateIntentProblems(c: TourCandidate, i: TourIntent, mode: IntentMatchMode = 'initial'): string[] {
  const e: string[] = [];
  if (i.excludedStops.includes(c.key) || i.rejectedOpportunityKeys.includes(c.key)) e.push('escluso');
  if (i.ownOrphansOnly && c.entityType === 'orphan' && c.isOwnOrphan !== true) e.push('orfano non proprio');
  const types = allowedTypesFor(i, mode);
  if (types && !types.has(c.entityType)) e.push('tipologia non autorizzata');
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) e.push('coordinate mancanti');
  const contactLimit = i.physicalContactMinDays ?? (mode !== 'initial' && c.entityType === 'prospect' ? DEFAULT_FILL_CONTACT_DAYS : null);
  if (contactLimit != null) {
    if (c.gptourData?.contactKnown === false) e.push('contatto fisico non verificato');
    else if (c.daysSincePhysicalContact != null && c.daysSincePhysicalContact < contactLimit) e.push('contatto fisico recente');
  }
  if (i.orderMinDays != null) {
    if (c.gptourData?.orderKnown === false) e.push('storico ordini non verificato');
    else if (c.daysSinceOrder != null && c.daysSinceOrder < i.orderMinDays) e.push('ordine recente');
  }
  if (i.minRevenue != null || i.maxRevenue != null) {
    if (c.gptourData?.revenueKnown === false) e.push('fatturato non verificato');
    else if ((i.minRevenue != null && c.revenue6m < i.minRevenue) || (i.maxRevenue != null && c.revenue6m > i.maxRevenue)) e.push('fatturato fuori soglia');
  }
  if (i.project && ![c.projectName, c.projectType].some((p) => {
    const s = norm(p), wanted = norm(i.project); return s && s !== 'nessun progetto' && (s === wanted || s.includes(wanted) || wanted.includes(s));
  })) e.push('progetto diverso');
  const a = i.requestedArea;
  if (a?.comune && norm(c.city) !== norm(a.comune)) e.push('comune diverso');
  // Fail closed on non comparable province strings; caller resolves aliases from its authorized pool.
  if (a?.provincia && norm(provinceCode(c.province) || c.province) !== norm(provinceCode(a.provincia) || a.provincia)) e.push('provincia diversa o non verificata');
  if (a?.zona && !c.gptourData?.zoneNames?.some((z) => norm(z) === norm(a.zona))) e.push('fuori dalla zona richiesta');
  return e;
}
export function candidateMatchesTourIntent(c: TourCandidate, i: TourIntent, mode: IntentMatchMode = 'initial', blocked?: Set<string>): boolean {
  return !blocked?.has(c.key) && candidateIntentProblems(c, i, mode).length === 0;
}
export function filterPoolByIntent(pool: TourCandidate[], i: TourIntent, mode: IntentMatchMode = 'initial', blocked?: Set<string>) {
  return pool.filter((c) => candidateMatchesTourIntent(c, i, mode, blocked));
}