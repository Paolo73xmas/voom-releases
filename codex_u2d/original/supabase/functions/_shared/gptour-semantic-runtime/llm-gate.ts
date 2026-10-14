// LlmPort decorator: persisted output → replay (zero dispatch); otherwise reserve → ONE dispatch → validate → store → return.
// Infrastructure outcomes are recorded structurally so the turn can distinguish them from U1 semantic errors.
import type { LlmCall, LlmPort } from '../gptour-semantic/interpreter.ts';
import { validateLlmOutput } from '../gptour-semantic/schema.ts';
import { type RecoveredWork, type SemanticStore, StoreError, type TrustedCaller } from './store-port.ts';
import { LlmProviderError } from './ports.ts';
/** provider_error.retryable is true ONLY for a structured transient fault (timeout/429/5xx/network); unstructured errors are treated as permanent (no second paid call). */
export type GateOutcome = { kind: 'replayed' } | { kind: 'dispatched'; invocationId: string } | { kind: 'budget_exhausted' } | { kind: 'reservation_uncertain' }
  | { kind: 'lease_short' } | { kind: 'provider_error'; retryable: boolean; status: number | null } | { kind: 'store_failed'; message: string } | { kind: 'store_uncertain_recovered' } | { kind: 'invalid_output' };
export interface GatedLlm { port: LlmPort; outcomes: GateOutcome[]; dispatches: number }
export function gatedLlm(inner: LlmPort, store: SemanticStore, c: TrustedCaller, sid: string, rid: string, token: string, recovered: RecoveredWork | null,
  o: { newId: () => string; ensureResidual: () => Promise<boolean> }): GatedLlm {
  const g: GatedLlm = { outcomes: [], dispatches: 0, port: { model: inner.model, complete } };
  let persisted: unknown | null = recovered?.llmOutput ?? null;
  async function complete(call: LlmCall): Promise<string> {
    if (persisted !== null) { g.outcomes.push({ kind: 'replayed' }); return JSON.stringify(persisted); }
    if (!(await o.ensureResidual())) { g.outcomes.push({ kind: 'lease_short' }); throw new Error('lease residual too short for a dispatch'); }
    const invocationId = o.newId();
    let begin;
    try { begin = await store.beginLlm(c, sid, rid, token, invocationId); }
    catch (e) { g.outcomes.push(e instanceof StoreError && e.uncertain ? { kind: 'reservation_uncertain' } : { kind: 'store_failed', message: String((e as Error).message) }); throw e; }
    if (!begin.mayDispatch) {
      if (begin.outputStored) { const w = await store.recoverWork(c, sid, rid, token); persisted = w.llmOutput; g.outcomes.push({ kind: 'replayed' }); return JSON.stringify(persisted); }
      g.outcomes.push({ kind: 'budget_exhausted' }); throw new Error('llm budget exhausted');
    }
    g.dispatches++; g.outcomes.push({ kind: 'dispatched', invocationId });
    let text: string;
    try { text = await inner.complete(call); } catch (e) { g.outcomes.push(e instanceof LlmProviderError ? { kind: 'provider_error', retryable: e.retryable, status: e.status } : { kind: 'provider_error', retryable: false, status: null }); throw e; }
    let parsed: unknown; try { parsed = JSON.parse(text); } catch { g.outcomes.push({ kind: 'invalid_output' }); return text; }
    if (!validateLlmOutput(parsed).ok) { g.outcomes.push({ kind: 'invalid_output' }); return text; }
    try { await store.storeLlm(c, sid, rid, token, invocationId, parsed); }
    catch (e) {
      if (e instanceof StoreError && e.uncertain) { const w = await store.recoverWork(c, sid, rid, token); if (w.llmOutput !== null) { g.outcomes.push({ kind: 'store_uncertain_recovered' }); persisted = w.llmOutput; return JSON.stringify(persisted); } }
      g.outcomes.push({ kind: 'store_failed', message: String((e as Error).message) }); throw e;
    }
    persisted = parsed; return text;
  }
  return g;
}
