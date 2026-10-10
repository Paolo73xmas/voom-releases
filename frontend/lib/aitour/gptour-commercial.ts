import type { CommercialGroups, TourIntent } from './gptour-intent';
import type { TourCandidate } from './types';

/** In mixed intents the legacy global purchase flags are deliberately OFF. */
export const verifiedPurchaseDays = (i: TourIntent): number | null => i.commercialGroups
  ? i.commercialGroups.existing ? i.commercialGroups.inactiveDays : null
  : i.requireOrderHistory ? i.orderMinDays : null;

export function missingRequestedGroup(keys: string[], pool: TourCandidate[], i: TourIntent): boolean {
  if (!i.commercialGroups?.existing || !i.commercialGroups.newPoints) return false;
  const kinds = new Set(pool.filter(c => keys.includes(c.key)).map(c => c.gptourData?.commercial?.relationship === 'none' ? 'new' : 'existing'));
  return !kinds.has('new') || !kinds.has('existing');
}

/** A CRM category is not evidence. Only the GPTour loader/verified order loader stamps facts. */
export function commercialProblems(c: TourCandidate, groups: CommercialGroups): string[] {
  const f = c.gptourData?.commercial;
  if (!f?.authorized) return ['autorizzazione commerciale non verificata'];
  const relation = f.relationship === 'own' || (!groups.ownOnly && f.relationship === 'other');
  const fresh = f.relationship === 'none' && f.newPointVerified && !c.customerId
    && !c.lastVisitDate && !c.lastPhysicalContactDate && !c.lastOrderDate && !(c.orderCount > 0);
  if (groups.newPoints && fresh) return [];
  if (!groups.existing || !relation) return ['gruppo commerciale non autorizzato o non verificato'];
  if (groups.needsDays) return ['specificare i giorni di inattività acquisti'];
  if (groups.inactiveDays != null) {
    if (!f.purchasesVerified || !c.lastOrderDate || c.daysSinceOrder == null || !Number.isFinite(c.daysSinceOrder))
      return ['senza storico acquisti verificato'];
    if (c.daysSinceOrder < groups.inactiveDays) return ['ordine recente'];
  }
  return [];
}

export function commercialLabels(i: TourIntent): string[] {
  const g = i.commercialGroups;
  if (!g) return [];
  return [g.existing && (g.needsDays ? 'Clienti inattivi · giorni da specificare' : g.inactiveDays != null
    ? `Clienti con ordini ≥ ${g.inactiveDays} gg` : 'Clienti con relazione commerciale'),
    g.newPoints && 'Nuovi punti mai visitati', g.ownOnly && 'Relazioni del mio portafoglio'].filter((s): s is string => !!s);
}

export function validateCommercialGroups(value: unknown): CommercialGroups | undefined {
  if (value === undefined) return undefined;
  const g = value as CommercialGroups;
  if (!g || g.version !== 1 || ['existing', 'newPoints', 'ownOnly', 'needsDays'].some(k => typeof g[k as keyof CommercialGroups] !== 'boolean')
    || (g.inactiveDays !== null && (!Number.isInteger(g.inactiveDays) || g.inactiveDays <= 0))
    || (!g.existing && !g.newPoints)) throw new Error('Criteri commerciali non validi: ricrea la richiesta GPTour.');
  return { ...g };
}