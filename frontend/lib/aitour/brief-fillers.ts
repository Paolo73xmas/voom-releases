// Riempitivi "se avanza tempo": visite aggiunte SOLO nel tempo residuo, vicino al giro, senza togliere tappe.
// Parità web src/lib/aitour/brief-fillers.ts
import type { TourBriefV4 } from './brief-v4';
import { selectCandidatesV4, fillerLabel } from './brief-v4';
import type { CandidatePool } from './data';
import type { TourCandidate, TourPlan } from './types';
import { planTour, type PlanInput, type PlanQuota } from './planner';
import { splitRecentlyServed, RECENT_CONTACT_DAYS } from './scoring';
import { assignJourneyStages } from './brief-journey';

export interface FillerSet { list: TourCandidate[]; quotas: PlanQuota[]; notes: string[] }

export function fillerCandidates(brief: TourBriefV4, pool: CandidatePool, planned: TourCandidate[], excludedIds: Set<string | undefined>, date: string): FillerSet {
  const notes: string[] = [];
  const quotas: PlanQuota[] = [];
  const taken = new Set<string>();
  for (const c of planned) { taken.add(c.key); if (c.customerId) taken.add(`c:${c.customerId}`); if (c.tabaccheriaId) taken.add(`t:${c.tabaccheriaId}`); }
  const isTaken = (c: TourCandidate) => taken.has(c.key) || (!!c.customerId && taken.has(`c:${c.customerId}`)) || (!!c.tabaccheriaId && taken.has(`t:${c.tabaccheriaId}`));
  const box = planned.length ? {
    minLat: Math.min(...planned.map((c) => c.lat)) - 0.05, maxLat: Math.max(...planned.map((c) => c.lat)) + 0.05,
    minLng: Math.min(...planned.map((c) => c.lng)) - 0.07, maxLng: Math.max(...planned.map((c) => c.lng)) + 0.07,
  } : null;
  const minMain = planned.length ? Math.min(...planned.map((c) => c.score)) : 0;
  const out: TourCandidate[] = [];
  for (const f of brief.fillers) {
    const label = fillerLabel(f);
    const sel = selectCandidatesV4({ ...brief, selection: f.selection, includeAutomatic: true, projectRules: [], fillers: [] }, pool);
    if (sel.newAround) notes.push(`${label}: la ricerca di nuovi punti vendita nel raggio non è disponibile come riempitivo`);
    let list = sel.candidates.filter((c) => !isTaken(c) && !excludedIds.has(c.customerId || ''));
    list = splitRecentlyServed(list, RECENT_CONTACT_DAYS, date).kept;
    if (box) list = list.filter((c) => c.lat >= box.minLat && c.lat <= box.maxLat && c.lng >= box.minLng && c.lng <= box.maxLng);
    list = assignJourneyStages(list, brief.journey)
      .map((c) => ({ ...c, score: Math.min(c.score, minMain - 5), reason: `Riempitivo "se avanza tempo". ${c.reason}` }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    if (!list.length) { notes.push(`${label}: nessun soggetto idoneo vicino al giro`); continue; }
    for (const c of list) { taken.add(c.key); if (c.customerId) taken.add(`c:${c.customerId}`); if (c.tabaccheriaId) taken.add(`t:${c.tabaccheriaId}`); }
    out.push(...list);
    if (f.target.value) quotas.push({ label, keys: new Set(list.map((c) => c.key)), min: null, max: f.target.value });
  }
  return { list: out, quotas, notes };
}

export async function addBriefFillers(args: {
  brief: TourBriefV4; plan: TourPlan; loaded: CandidatePool; excludedIds: Set<string | undefined>; date: string;
  mandatoryKeys: Set<string>; quotas: PlanQuota[]; planInput: PlanInput;
}): Promise<{ plan: TourPlan; notes: string[] }> {
  const { brief, plan, loaded, excludedIds, date, mandatoryKeys, quotas, planInput } = args;
  const main = plan.stops.map((s) => ({ ...s.candidate, requestedPriority: s.candidate.requestedPriority ?? 2 }));
  const fill = fillerCandidates(brief, loaded, main, excludedIds, date);
  if (!fill.list.length) return { plan, notes: fill.notes };
  const dense = await planTour({
    ...planInput,
    candidates: [...main, ...fill.list],
    mandatoryKeys: new Set(main.map((c) => c.key)),
    quotas: [...quotas, ...fill.quotas],
  });
  const mainKeys = new Set(main.map((c) => c.key));
  const keepsAll = main.every((c) => dense.stops.some((s) => s.candidate.key === c.key));
  const added = dense.stops.filter((s) => !mainKeys.has(s.candidate.key)).length;
  if (!keepsAll || added === 0) {
    return { plan, notes: [...fill.notes, `Riempitivi: nessun tempo residuo nel giro per "${brief.fillers.map(fillerLabel).join('", "')}"`] };
  }
  dense.stops.forEach((s) => { s.mandatory = mandatoryKeys.has(s.candidate.key); });
  dense.requiredStops = plan.requiredStops;
  dense.warnings = dense.warnings.filter((w) => !w.startsWith('La visita obbligatoria'));
  return { plan: dense, notes: [...fill.notes, `Riempitivi: aggiunte ${added} visite "se avanza tempo" nel tempo residuo`] };
}
