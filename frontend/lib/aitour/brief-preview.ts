// Anteprima dei candidati PRIMA della generazione: stessi filtri della pipeline
// (selezione V4, esclusioni scelte, regola 15 giorni), cosi' il riassunto non mente.
// Parità web src/lib/aitour/brief-preview.ts
import type { TourBriefV4 } from './brief-v4';
import { selectCandidatesV4, targetCap } from './brief-v4';
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
  return {
    eligible: served.kept.length,
    recentlyExcluded: served.excluded,
    named,
    planned,
    registryPending: wantsDevelopmentRegistry(brief),
    newAroundPending: !!sel.newAround && brief.includeAutomatic !== false,
    warnings: sel.warnings,
  };
}
