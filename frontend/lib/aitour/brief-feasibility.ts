import type { TourPlan, SavedAreaFilter } from './types';
import { isoWeekday } from '../visit-slots';
import { journeyPlanProblems } from './brief-journey';
import { assertGptourPlan } from './gptour-context';

export function mandatoryProblems(plan: TourPlan): string[] {
  if (!plan.requiredStops?.length && !plan.areaFilter?.briefJourney) return [];
  const errors = journeyPlanProblems(plan);
  for (const required of plan.requiredStops || []) {
    const s = plan.stops.find((x) => x.candidate.key === required.key);
    if (!s) { errors.push(`Priorità ${required.priority} · ${required.name}: non entra nel giro con questi vincoli`); continue; }
    if (s.outsideWindow) errors.push(`${required.name}: arrivo fuori dalla fascia concordata`);
    if (s.candidate.excludedDays?.includes(isoWeekday(plan.tourDate))) errors.push(`${required.name}: non riceve visite nel giorno scelto`);
    if (s.departureMin > plan.endMin || s.arrivalMin < plan.startMin) errors.push(`${required.name}: visita fuori dall'orario di lavoro`);
  }
  if (plan.finishMin - (plan.returnFlexible ? plan.returnMin : 0) > plan.endMin) errors.push('Visite e arrivo finale superano l’orario disponibile');
  if (plan.routingFallback) errors.push('Tempi stradali non verificati: riprova il calcolo prima di confermare gli obbligatori');
  return [...new Set(errors)];
}
export function assertMandatoryFeasible(plan: TourPlan): void {
  assertGptourPlan(plan);
  const errors = mandatoryProblems(plan);
  if (errors.length) throw new Error(errors.join('. '));
}
export function planAreaMetadata(plan: TourPlan): SavedAreaFilter | null {
  if (!plan.requiredStops?.length && !plan.areaFilter?.briefJourney) return plan.areaFilter ?? null;
  return { ...(plan.areaFilter || { mode: 'auto' }),
    briefRequirements: (plan.requiredStops || []).map((r) => { const c = plan.stops.find((s) => s.candidate.key === r.key)?.candidate; return { ...r, customerId: c?.customerId || null, excludedDays: c?.excludedDays }; }),
    returnFlexible: !!plan.returnFlexible, returnMin: plan.returnMin, finishMin: plan.finishMin, routingFallback: plan.routingFallback };
}