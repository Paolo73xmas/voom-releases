// Pure public projection: no persistence, no claim/commit or planner. Explicit whitelist prevents deferred/history leaks.
import type { PendingQuestion, PublicQuestion, SemanticResult, SemanticState } from '../gptour-semantic/contract.ts';
import { TRANSPORT_VERSION, type OperationalContext, type StateSnapshot, type Gate } from './contract.ts';
export const publicQuestion = (q: PublicQuestion): PublicQuestion => ({ id: q.id, kind: q.kind, text: q.text,
  options: q.options.map(o => ({ id: o.id, label: o.label })) });
export function openQuestions(top: PendingQuestion | null): PublicQuestion[] {
  const out: PublicQuestion[] = [], seen = new Set<PendingQuestion>();
  for (let q = top; q; q = q.previous ?? null) {
    if (seen.has(q)) throw new Error('Cyclic question stack');
    seen.add(q); out.push(publicQuestion(q));
  }
  return out;
}
export function projectResult(r: SemanticResult): Omit<SemanticResult, 'contractVersion'> & { contractVersion: typeof TRANSPORT_VERSION } {
  return { contractVersion: TRANSPORT_VERSION, sessionId: r.sessionId, requestId: r.requestId, status: r.status,
    revision: r.revision, criteria: structuredClone(r.criteria), changed: [...r.changed], applied: structuredClone(r.applied),
    rejected: structuredClone(r.rejected), question: r.question ? publicQuestion(r.question) : null,
    errorCode: r.errorCode, message: r.message, notices: [...r.notices],
    diagnostics: { interpreter: r.diagnostics.interpreter, llmCalls: r.diagnostics.llmCalls, model: r.diagnostics.model, ms: r.diagnostics.ms } };
}
export function projectState(state: SemanticState, context: OperationalContext, meta: { engineVersion: string; expiresAt: string; gate: Gate | null; notices: string[] }): StateSnapshot {
  const questions = openQuestions(state.pendingQuestion);
  return { sessionId: state.sessionId, sessionRevision: state.revision, criteria: structuredClone(state.criteria),
    question: questions[0] ?? null, openQuestions: questions, openQuestionCount: questions.length,
    notices: [...meta.notices], gate: meta.gate, expiresAt: meta.expiresAt, contractVersion: TRANSPORT_VERSION, engineVersion: meta.engineVersion,
    context: { departure: context.departure ? { lat: context.departure.lat, lng: context.departure.lng, ...(context.departure.label === undefined ? {} : { label: context.departure.label }) } : null,
      departureSource: context.departureSource, acquiredAt: context.acquiredAt, gps: context.gps ? { lat: context.gps.lat, lng: context.gps.lng, accuracyM: context.gps.accuracyM, capturedAt: context.gps.capturedAt } : null,
      lastPlanId: context.lastPlanId, planRevision: context.planRevision } };
}