import type { TourCandidate, TourPlan } from './types';
import type { SavedTour } from './tours';
import { assignJourneyStages, journeyProblems } from './brief-journey';
import { assertMandatoryFeasible } from './brief-feasibility';
import { restoreGptourCandidate } from './gptour-context';

export function restoreBriefCandidate(c: TourCandidate, tour: Pick<SavedTour, 'area_filter'>): TourCandidate {
  c = restoreGptourCandidate(c, tour.area_filter);
  const requirement = tour.area_filter?.briefRequirements?.find((r) => r.customerId ? r.customerId === c.customerId : r.key === c.key);
  return assignJourneyStages([{ ...c, ...(requirement ? { key: requirement.key, requestedPriority: requirement.priority, excludedDays: requirement.excludedDays } : {}) }], tour.area_filter?.briefJourney)[0];
}
export function protectLivePlan(plan: TourPlan, tour: SavedTour, pending: TourCandidate[]): TourPlan {
  const metadata = tour.area_filter;
  const required = (metadata?.briefRequirements || []).filter((r) => pending.some((c) => r.customerId ? c.customerId === r.customerId : c.key === r.key));
  const restored = { ...plan, stops: plan.stops.map((s) => ({ ...s, candidate: restoreBriefCandidate(s.candidate, tour) })),
    areaFilter: metadata ? { ...metadata, journeyStageCounts: [] } : null,
    requiredStops: required.map((r) => ({ key: pending.find((c) => r.customerId ? c.customerId === r.customerId : c.key === r.key)?.key || r.key, name: r.name, priority: r.priority })), returnFlexible: metadata?.returnFlexible };
  assertMandatoryFeasible(restored);
  if (metadata?.gptourContext) Object.assign(plan, restored);
  return restored;
}
export function assertCompleteReplan(plan: TourPlan, candidates: TourCandidate[]): void {
  const keys = new Set(plan.stops.map((s) => s.candidate.key));
  if (keys.size !== plan.stops.length || candidates.some((c) => !keys.has(c.key))) throw new Error('Ricalcolo incompleto: le tappe esistenti sono rimaste invariate. Riprova.');
}
export function assertSavedJourneyReady(tour: SavedTour): void {
  const errors = journeyProblems(tour.area_filter?.briefJourney);
  if (errors.length) throw new Error(errors.join('. '));
}