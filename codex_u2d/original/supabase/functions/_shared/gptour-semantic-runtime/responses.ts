// Handler-side TurnResponse construction (policy from errors.ts) and receipt projection into the get_request contract.
import { TRANSPORT_VERSION, type ErrorCode, type Gate, type Outcome, type TurnResponse } from '../gptour-semantic-transport/contract.ts';
import { ERROR_POLICIES as POLICIES } from '../gptour-semantic-transport/errors.ts';
import type { Receipt } from './store-port.ts';
/** Identity as received: null only when absent/non-canonical (possible only in not_accepted errors). Never fabricated. */
export interface TurnIds { sessionId: string | null; requestId: string | null; engineVersion: string }
const empty = (ids: TurnIds): TurnResponse => ({ operation: 'turn', contractVersion: TRANSPORT_VERSION, engineVersion: ids.engineVersion, sessionId: ids.sessionId, requestId: ids.requestId,
  sessionRevision: null, outcome: 'committed', errorCode: null, retryableSameRequest: false, nextAction: 'none', retryAfterMs: null, acceptedAt: null, responseExpiresAt: null,
  result: null, gate: null, plan: null, openQuestions: [], openQuestionCount: 0, notApplied: [], dataQuality: null });
/** Error response; acceptedAt/responseExpiresAt only when the request was accepted (committed/recoverable/unknown/expired policies).
 *  `outcome` override: U1 `invalid_request` discovered AFTER claim is finalized as 400 **committed** (plan §4), not `not_accepted`. */
export function errorTurn(ids: TurnIds, code: ErrorCode, accepted: { acceptedAt: string; responseExpiresAt: string; sessionRevision: number | null } | null, retryAfterMs: number | null = null, outcome?: Outcome): TurnResponse {
  const p = { ...POLICIES[code], ...(outcome ? { outcome } : {}) };
  // correlationId identifies THIS error occurrence only (support/logs); it is never a sessionId/requestId and never drives replay.
  return { ...empty(ids), correlationId: crypto.randomUUID(), outcome: p.outcome, errorCode: code, retryableSameRequest: p.retryableSameRequest, nextAction: p.nextAction,
    retryAfterMs: p.retryableSameRequest ? (retryAfterMs ?? 1000) : null,
    acceptedAt: accepted && p.outcome !== 'not_accepted' ? accepted.acceptedAt : null, responseExpiresAt: accepted && p.outcome !== 'not_accepted' ? accepted.responseExpiresAt : null,
    sessionRevision: accepted?.sessionRevision ?? null };
}
/** Committed body skeleton: identity/revision/metadata/plan are stamped by the SQL (`align_body`); gate/result/questions are handler truth. */
export function committedTurn(ids: TurnIds, parts: Pick<TurnResponse, 'result' | 'gate' | 'openQuestions' | 'notApplied' | 'dataQuality'>): TurnResponse {
  return { ...empty(ids), ...parts, openQuestionCount: parts.openQuestions.length, plan: null };
}
/** Exact mirror of SQL gptour_semantic_terminal_turn (used by the in-memory store only). */
export function sqlTerminalTurn(r: { requestId: string; acceptedAt: string; responseExpiresAt: string }, s: { sessionId: string; revision: number; contractVersion: string; engineVersion: string }, code: 'processing_expired' | 'revision_conflict'): Record<string, unknown> {
  const p = POLICIES[code];
  return { operation: 'turn', contractVersion: s.contractVersion, engineVersion: s.engineVersion, sessionId: s.sessionId, requestId: r.requestId, sessionRevision: s.revision,
    outcome: p.outcome, errorCode: code, retryableSameRequest: p.retryableSameRequest, nextAction: p.nextAction, retryAfterMs: null, acceptedAt: r.acceptedAt, responseExpiresAt: r.responseExpiresAt,
    result: null, gate: null, plan: null, openQuestions: [], openQuestionCount: 0, notApplied: [], dataQuality: null };
}
export function receiptToGetRequest(ids: Omit<TurnIds, 'engineVersion'>, r: Receipt | null, nowMs: number) {
  const done = r?.status === 'done', processingExpired = r?.status === 'pending' && Date.parse(r.processingDeadline) <= nowMs;
  return { operation: 'get_request' as const, contractVersion: TRANSPORT_VERSION, sessionId: ids.sessionId, requestId: ids.requestId,
    receipt: { status: r ? r.status : 'not_found' as const, processingExpired, recoverable: r?.status === 'pending' && !processingExpired,
      processingDeadline: r?.status === 'pending' ? r.processingDeadline : null, responseExpiresAt: r ? r.responseExpiresAt : null,
      retryAfterMs: r?.status === 'pending' && !processingExpired ? 1000 : null, originalHttpStatus: done ? r!.httpStatus : null, response: done && r!.body ? JSON.parse(r!.body) : null } };
}
export type { Gate };
