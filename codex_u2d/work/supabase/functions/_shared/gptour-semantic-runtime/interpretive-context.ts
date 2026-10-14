// Interpretive context persisted BEFORE any LLM reservation. acceptedAt is DB-fixed; catalog/settings are the ones really used by this request.
import type { ReferenceCatalog } from '../gptour-semantic/contract.ts';
import { canonicalJson, sha256Hex } from './canonical.ts';
import type { InterpretiveContext } from './ports.ts';
export async function buildInterpretiveContext(p: { acceptedAt: string; catalog: ReferenceCatalog; workingDays: number[] | null; engineVersion: string; promptVersion: string; model: string }): Promise<InterpretiveContext> {
  return { acceptedAt: p.acceptedAt, catalog: JSON.parse(JSON.stringify(p.catalog)), catalogHash: await sha256Hex(canonicalJson(p.catalog)), workingDays: p.workingDays ? [...p.workingDays] : null,
    engineVersion: p.engineVersion, promptVersion: p.promptVersion, model: p.model };
}
export function isInterpretiveContext(v: unknown): v is InterpretiveContext {
  const o = v as Record<string, unknown> | null;
  return !!o && typeof o.acceptedAt === 'string' && typeof o.catalogHash === 'string' && typeof o.engineVersion === 'string' && !!o.catalog && typeof o.catalog === 'object'
    && (o.workingDays === null || (Array.isArray(o.workingDays) && o.workingDays.every(d => Number.isInteger(d))));
}
