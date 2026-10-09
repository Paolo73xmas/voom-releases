import type { EntityType, TourCandidate } from './types';
import type { TourIntent, TourIntentArea } from './gptour-intent';
import { normalizeComune } from './comuni-adjacency';
import { normalizeGptourName as norm } from './gptour-identity';
import { normalizeProvincia } from '../italy-provinces';
export type IntentMatchMode = 'initial' | 'fill' | 'corridor';
export const DEFAULT_FILL_CONTACT_DAYS = 15;
/** Stessa normalizzazione ISTAT del web per comuni richiesti e confinanti. */
export function requestedComuniNorm(area: TourIntentArea | null | undefined): Set<string> {
  const list = area?.comuni?.length ? area.comuni : (area?.comune ? [area.comune] : []);
  return new Set(list.map(normalizeComune).filter(Boolean));
}
/** Web 30b163a: la provincia è un confine, non un suggerimento. Dato mancante o non riconosciuto → fail-closed. */
export function provinceMatches(c: TourCandidate, provincia: string | null | undefined): boolean {
  if (!provincia) return true;
  const want = normalizeProvincia(provincia), have = normalizeProvincia(c.province || '');
  return !!want && !!have && want.sigla === have.sigla;
}
/** Comuni richiesti come CONFINE: città CRM o località verificate nella conversazione. Nessun comune richiesto → nessun vincolo. */
export function cityMatches(c: TourCandidate, area: TourIntentArea | null | undefined): boolean {
  const set = requestedComuniNorm(area);
  if (set.size === 0) return true;
  return [c.city, ...(c.matchedLocalities || [])].some((name) => set.has(normalizeComune(name || '')));
}
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
  // Web 30b163a: "non comprano da N giorni" richiede un ordine reale: mai visite, nuovi punti o chi non ha mai acquistato.
  if (i.requireOrderHistory && (!['client', 'orphan'].includes(c.entityType) || c.daysSinceOrder == null || !Number.isFinite(c.daysSinceOrder))) e.push('senza storico acquisti verificato');
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
  // Web parity (W gptour-criteria.ts @ 2eea993): comune e zona guidano ranking/selezione AI; la provincia resta rigida
  // (fail-closed su dati non confrontabili). Il comune diventa confine solo con perimetro deterministico (strictGeography,
  // fissato dalle regole conversazionali) — il completamento "tutti" resta già limitato al comune in prepareGptDays.
  if (!provinceMatches(c, a?.provincia)) e.push('provincia diversa o non verificata');
  if (i.strictGeography && !cityMatches(c, a)) e.push('fuori dal comune richiesto');
  return e;
}
/** Fuori dai comuni richiesti: warning sulle scelte AI, confine del completamento wantAll. */
export function outsideRequestedComune(c: TourCandidate, i: TourIntent): boolean {
  const area = i.requestedArea;
  const list = area?.comuni?.length ? area.comuni : (area?.comune ? [area.comune] : []);
  if (!list.length) return false;
  const have = norm(c.city);
  return !list.some((m) => norm(m) === have);
}
export function candidateMatchesTourIntent(c: TourCandidate, i: TourIntent, mode: IntentMatchMode = 'initial', blocked?: Set<string>): boolean {
  return !blocked?.has(c.key) && candidateIntentProblems(c, i, mode).length === 0;
}
export function filterPoolByIntent(pool: TourCandidate[], i: TourIntent, mode: IntentMatchMode = 'initial', blocked?: Set<string>) {
  return pool.filter((c) => candidateMatchesTourIntent(c, i, mode, blocked));
}