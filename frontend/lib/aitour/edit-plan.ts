import type { PlannedStop, TourCandidate, TourPlan } from './types';
import { fmtDur, minToTime } from './types';
import { planFixedOrder, planTour } from './planner';
import { areaConsentKey, outsideAreaReason } from './brief-area';
import { assignJourneyStages, validJourneyPoint } from './brief-journey';
import { assertMandatoryFeasible, planAreaMetadata } from './brief-feasibility';
import { assertCompleteReplan } from './brief-live';

export type EditAreaConsents = Record<string, string>;
export function sameEditSubject(a: TourCandidate, b: TourCandidate): boolean {
  return a.key === b.key || (!!a.customerId && a.customerId === b.customerId) || (!!a.tabaccheriaId && a.tabaccheriaId === b.tabaccheriaId);
}
export function editOutsideReason(plan: TourPlan, candidate: TourCandidate): string | null {
  if (plan.stops.some((s) => sameEditSubject(s.candidate, candidate))) return null;
  return outsideAreaReason(candidate, plan.areaFilter?.briefAreas || [], plan.areaFilter?.briefJourney);
}
export const editAreaConsentKey = (plan: TourPlan, candidate: TourCandidate) => areaConsentKey(candidate, plan.areaFilter?.briefAreas || [], plan.areaFilter?.briefJourney);

// Una modifica esplicita alle stelle aggiorna sia i flag visivi sia i vincoli.
// Le finestre orarie/coordinate delle tappe del piano prevalgono sul pool.
export function prepareEditedPlan(plan: TourPlan, candidates: TourCandidate[], keys: string[], mandatory: Set<string>, consents: EditAreaConsents = {}) {
  if (!keys.length) throw new Error('Aggiungi almeno una visita al giro');
  if (new Set(keys).size !== keys.length) throw new Error('Una tappa è stata aggiunta due volte: rimuovi il doppione');
  const byKey = new Map(candidates.map((c) => [c.key, c]));
  for (const s of plan.stops) byKey.set(s.candidate.key, s.candidate);
  const chosen = keys.map((key) => {
    const c = byKey.get(key);
    if (!c) throw new Error('Una delle tappe selezionate non è più disponibile. Rimuovila e cercala di nuovo.');
    if (!validJourneyPoint({ lat: c.lat, lng: c.lng })) throw new Error(`${c.name}: coordinate mancanti o non valide. Rimuovi la tappa o correggi l’anagrafica.`);
    return { ...c };
  });
  const exceptions: string[] = [];
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    if (chosen.slice(0, i).some((other) => sameEditSubject(c, other))) throw new Error(`${c.name}: lo stesso punto vendita è presente due volte nel giro`);
    const reason = editOutsideReason(plan, c);
    if (reason) {
      if (consents[c.key] !== editAreaConsentKey(plan, c)) throw new Error(`${c.name}: ${reason}. Premi “Conferma eccezione fuori zona” sotto questa tappa, oppure rimuovila.`);
      exceptions.push(`Eccezione fuori zona confermata: ${c.name}`);
    } else if (outsideAreaReason(c, plan.areaFilter?.briefAreas || [], plan.areaFilter?.briefJourney)) {
      exceptions.push(`Tappa fuori zona già presente nel giro: ${c.name}`);
    }
  }
  const requiredStops = chosen.filter((c) => mandatory.has(c.key)).map((c) => ({
    key: c.key, name: c.name, priority: plan.requiredStops?.find((r) => r.key === c.key)?.priority ?? c.requestedPriority ?? 2,
  }));
  const staged = assignJourneyStages(chosen.map((c) => ({ ...c, requestedPriority: requiredStops.find((r) => r.key === c.key)?.priority })), plan.areaFilter?.briefJourney);
  const stops: PlannedStop[] = staged.map((candidate, i) => ({
    candidate, sequence: i + 1, arrivalMin: 0, departureMin: 0, travelMinFromPrev: 0, travelKmFromPrev: 0, waitMin: 0, outsideWindow: false, mandatory: mandatory.has(candidate.key),
  }));
  const base: TourPlan = { ...plan, stops, requiredStops, areaFilter: plan.areaFilter ? {
    ...plan.areaFilter,
    // Pulisce anche i metadati di un piano salvato quando si tolgono tutte le stelle.
    briefRequirements: requiredStops.map((r) => { const c = staged.find((s) => s.key === r.key)!; return { ...r, customerId: c.customerId, excludedDays: c.excludedDays }; }),
  } : null };
  return { base, chosen: staged, exceptions };
}

interface EditPlanner { optimized: typeof planTour; manual: typeof planFixedOrder }
const defaultPlanner: EditPlanner = { optimized: planTour, manual: planFixedOrder };
export async function recalculateEditedPlan(plan: TourPlan, candidates: TourCandidate[], keys: string[], mandatory: Set<string>, fixedOrder: boolean, consents: EditAreaConsents = {}, planner: EditPlanner = defaultPlanner, timeoutMs = 60000): Promise<TourPlan> {
  const { base, chosen, exceptions } = prepareEditedPlan(plan, candidates, keys, mandatory, consents);
  const operation = fixedOrder ? planner.manual(chosen, base) : planner.optimized({
    candidates: chosen, mandatoryKeys: new Set(chosen.map((c) => c.key)),
    start: base.start, end: base.end, tourDate: base.tourDate, startMin: base.startMin, endMin: base.endMin,
    dayType: base.dayType, resolvedDayType: base.resolvedDayType, bufferPct: 0, area: { mode: 'auto' },
    enforceJourneyOrder: !!base.areaFilter?.briefJourney, returnFlexible: base.returnFlexible,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const calculated = await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Il calcolo del percorso sta impiegando troppo tempo. Le modifiche sono conservate: controlla la connessione e riprova.')), timeoutMs);
    })]);
    const next: TourPlan = { ...calculated, areaLabel: base.areaLabel, aiRecommendation: null,
      areaFilter: base.areaFilter, requiredStops: base.requiredStops, returnFlexible: base.returnFlexible,
      stops: calculated.stops.map((s) => ({ ...s, mandatory: mandatory.has(s.candidate.key) })),
      warnings: [...new Set([...calculated.warnings, ...exceptions])],
    };
    assertCompleteReplan(next, chosen);
    assertMandatoryFeasible(next);
    next.areaFilter = planAreaMetadata(next);
    return next;
  } finally { if (timer) clearTimeout(timer); }
}

export function editedTourSummary(plan: TourPlan): string {
  const mandatory = plan.stops.filter((s) => s.mandatory).length;
  return `Giro aggiornato: ${plan.stops.length} visite, di cui ${mandatory} obbligatorie. ${plan.totalKm.toFixed(0)} km e ${fmtDur(plan.driveMin)} di guida. Fine prevista alle ${minToTime(plan.finishMin)}.`;
}