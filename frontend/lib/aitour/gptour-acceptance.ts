import type { TourCandidate } from './types';
import type { TourIntent } from './gptour-intent';
import { candidateIntentProblems } from './gptour-criteria';

/** Optional mobile-context metadata, never inferred from or accepted in an LLM response. */
export function readAcceptedFillKeys(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.some((key) => typeof key !== 'string' || !key.trim()))
    throw new Error('Elenco delle tappe fill accettate non valido. Verifica il contesto GPTour.');
  return [...new Set(raw as string[])];
}

export function retainAcceptedFillKeys(keys: readonly string[], presentKeys: Iterable<string>): string[] {
  const present = new Set(presentKeys);
  return [...new Set(keys)].filter((key) => present.has(key));
}

/** Type criteria are not broadened; only an explicitly accepted exact key uses fill validation. */
export function acceptedCandidateProblems(candidate: TourCandidate, intent: TourIntent, keys: readonly string[]): string[] {
  return candidateIntentProblems(candidate, intent, keys.includes(candidate.key) ? 'fill' : 'initial');
}

/** Only called by the explicit Accept action, with the currently displayed proposal. */
export function acceptDisplayedFillKeys(previous: readonly string[], proposal: { candidates: TourCandidate[]; orderedKeys: string[] },
  authorizedPool: TourCandidate[], intent: TourIntent): string[] {
  const byKey = new Map(authorizedPool.map((c) => [c.key, c]));
  for (const offered of proposal.candidates) {
    const current = byKey.get(offered.key);
    if (!current || !proposal.orderedKeys.includes(offered.key))
      throw new Error('La proposta non è più disponibile nel portafoglio autorizzato. Ricalcola prima di accettarla.');
    const problems = candidateIntentProblems(current, intent, 'fill');
    if (problems.length) throw new Error(`${current.name}: proposta non più idonea (${problems.join(', ')}). Nessuna deroga ai criteri.`);
  }
  return [...new Set([...previous, ...proposal.candidates.map((c) => c.key)])];
}

export function acceptedKeysAfterIntentPatch(keys: readonly string[], previous: TourIntent,
  patch?: Partial<TourIntent>, reset = false): string[] {
  if (reset) return [];
  for (const field of ['requestedEntityTypes', 'allowedExpansionTypes'] as const) {
    if (patch?.[field] !== undefined && [...new Set(previous[field])].sort().join('|') !== [...new Set(patch[field])].sort().join('|')) return [];
  }
  // Other changes revalidate every accepted key against the new criteria during rebuild.
  return [...keys];
}