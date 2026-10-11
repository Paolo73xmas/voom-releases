import type { ContractBinding, RequestEnvelope, ServerSnapshot } from './contract';
import { validateWireResponse } from './wire-response';
import { encodeWireAction, validateWireRequest } from './wire-actions';
import { criteriaLabels, presentPlan, presentQuestion } from './presentation';
import { OrchestratorError } from './errors';
/** Official package reviewed offline. This does NOT attest the currently deployed service version. */
export function decodeOfficialResponse(raw: unknown, req: Readonly<RequestEnvelope>): ServerSnapshot {
  const small = raw as Record<string, unknown> | null;
  if (small?.status === 'blocked' && small.errorCode === 'pilot_not_enabled' && typeof small.error === 'string' && !small.sessionId) {
    return { sessionId: req.sessionId, revision: req.expectedRevision ?? 0, revisionConfirmed: false,
      status: 'blocked', messages: [{ id: `${req.requestId}-a`, role: 'assistant', text: small.error }],
      questions: [], plan: null, planId: null, warnings: [], errorCode: 'pilot_not_enabled' };
  }
  validateWireResponse(raw, req);
  if (raw.status !== 'ready' && raw.status !== 'planning' && raw.plan !== null) throw new OrchestratorError('INVALID_RESPONSE');
  return { sessionId: raw.sessionId, revision: raw.sessionRevision, status: raw.status, revisionConfirmed: true,
    messages: [{ id: `${raw.requestId}-a`, role: 'assistant', text: raw.message }], questions: raw.question ? [presentQuestion(raw.question)] : [],
    plan: raw.plan ? presentPlan(raw.plan) : null, planId: raw.planId, engineVersion: raw.engineVersion, errorCode: raw.errorCode,
    criteria: criteriaLabels(raw.criteria), pendingDecisions: raw.pendingDecisions, warnings: [...raw.conflicts, ...raw.dataQuality.notes] };
}
export const APPROVED_ORCHESTRATOR_BINDING: ContractBinding = {
  version: '1.0', provenance: 'handoff-verified', recoveryRevision: 'confirmed', historyMode: 'local-transcript',
  validateRequest: validateWireRequest, encodeAction: encodeWireAction, decodeResponse: decodeOfficialResponse,
};