// Anteprima dei candidati PRIMA della generazione: stessi filtri della pipeline
// (selezione V4, esclusioni scelte, regola 15 giorni), cosi' il riassunto non mente.
// Parità web src/lib/aitour/brief-preview.ts
import type { TourBriefV4 } from './brief-v4';
import { selectCandidatesV4, targetCap, matchProjectName, projectRuleLabel, fillerLabel } from './brief-v4';
import type { CandidatePool } from './data';
import type { TourCandidate } from './types';
import { splitRecentlyServed, RECENT_CONTACT_DAYS } from './scoring';
import { wantsDevelopmentRegistry } from './brief-development';

export interface BriefPreview {
  /** Clienti automatici idonei dopo tutti i filtri (esclusi i nominati) */
  eligible: number;
  /** Esclusi per contatto/ordine recente */
  recentlyExcluded: TourCandidate[];
  /** Tappe nominate confermate (obbligatorie + desiderate) */
  named: number;
  /** Visite che verranno proposte al planner (prima dei vincoli di tempo/strada) */
  planned: number;
  /** Disponibilità per ogni quota progetto (es. "Almeno 6 FED": 5 idonei) */
  quotaNotes: { label: string; available: number; short: boolean }[];
  /** Soggetti idonei per ogni riempitivo "se avanza tempo" */
  fillerNotes: { label: string; available: number }[];
  registryPending: boolean;
  newAroundPending: boolean;
  warnings: string[];
}

export function previewBriefCandidates(brief: TourBriefV4, pool: CandidatePool, tourDate: string): BriefPreview {
  const sel = selectCandidatesV4(brief, pool);
  const excludedIds = new Set([...brief.mandatoryStops, ...brief.preferredStops].filter((r) => r.areaDecision === 'exclude').map((r) => r.selectedCustomerId));
  const namedIds = new Set([...brief.mandatoryStops, ...brief.preferredStops].filter((r) => r.areaDecision !== 'exclude' && r.selectedCustomerId).map((r) => r.selectedCustomerId));
  const auto = brief.includeAutomatic === false ? [] : sel.candidates.filter((c) => !excludedIds.has(c.customerId || '') && !namedIds.has(c.customerId || ''));
  const served = splitRecentlyServed(auto, RECENT_CONTACT_DAYS, tourDate);
  const cap = targetCap(brief.visitTarget);
  const named = namedIds.size;
  const total = served.kept.length + named;
  const planned = cap == null ? total : brief.visitTarget.scope === 'automatic_plus_mandatory' ? Math.min(served.kept.length, cap) + named : Math.max(named, Math.min(total, cap));
  const eligibleAll = [...served.kept, ...sel.candidates.filter((c) => namedIds.has(c.customerId || ''))];
  const quotaNotes = brief.projectRules.filter((r) => r.type !== 'priority').map((r) => {
    const n = eligibleAll.filter((c) => matchProjectName(c, [r.project])).length;
    const need = r.type === 'ratio' ? (cap ? Math.round((r.value || 0) * cap) : null) : r.type === 'maximum_count' ? null : r.value;
    return { label: projectRuleLabel(r), available: n, short: need != null && n < need };
  });
  const fillerNotes = brief.fillers.map((f) => {
    const fs = selectCandidatesV4({ ...brief, selection: f.selection, includeAutomatic: true, projectRules: [], fillers: [] }, pool);
    const list = splitRecentlyServed(fs.candidates.filter((c) => !namedIds.has(c.customerId || '') && !excludedIds.has(c.customerId || '') && !served.kept.some((k) => k.key === c.key)), RECENT_CONTACT_DAYS, tourDate).kept;
    return { label: fillerLabel(f), available: list.length };
  });
  return {
    eligible: served.kept.length,
    recentlyExcluded: served.excluded,
    named,
    planned,
    quotaNotes,
    fillerNotes,
    registryPending: wantsDevelopmentRegistry(brief),
    newAroundPending: !!sel.newAround && brief.includeAutomatic !== false,
    warnings: sel.warnings,
  };
}
