// Declarative policy only: 'committed' here is a REQUIRED future persistence outcome, not a claim that U2-a saved anything.
import type { SemanticErrorCode } from '../gptour-semantic/contract.ts';
import type { ErrorCode, ErrorPolicy, NextAction, Outcome } from './contract.ts';
const p = (httpStatus: number, outcome: Outcome, nextAction: NextAction, userConfirmation = false, retryableSameRequest = false): ErrorPolicy =>
  ({ httpStatus, outcome, retryableSameRequest, nextAction, userConfirmation });
export const ERROR_POLICIES: Readonly<Record<ErrorCode, ErrorPolicy>> = Object.freeze({
  invalid_request: p(400, 'not_accepted', 'correct_request', true), unsupported_contract: p(400, 'not_accepted', 'update_client'),
  unauthenticated: p(401, 'not_accepted', 'authenticate'), pilot_not_enabled: p(403, 'not_accepted', 'restore_access'),
  forbidden_agent: p(403, 'not_accepted', 'restore_access'), forbidden_session: p(403, 'not_accepted', 'restore_access'),
  agent_mismatch: p(403, 'not_accepted', 'restore_access', true), service_disabled: p(503, 'not_accepted', 'get_request'),
  access_unavailable: p(503, 'not_accepted', 'retry_same_request', false, true), session_unavailable: p(410, 'expired', 'create_session_and_confirm', true),
  request_id_reused: p(422, 'not_accepted', 'get_request', true), request_in_progress: p(409, 'recoverable', 'get_request', false, true),
  lease_lost: p(409, 'recoverable', 'get_request', false, true), revision_conflict: p(409, 'committed', 'get_state_and_confirm', true),
  unknown_question: p(409, 'committed', 'get_state_and_confirm', true), context_changed: p(409, 'committed', 'get_state_and_confirm', true),
  engine_changed: p(409, 'committed', 'get_state_and_confirm', true), llm_retryable: p(503, 'recoverable', 'retry_same_request', false, true),
  llm_budget_exhausted: p(503, 'committed', 'confirm_new_turn', true), llm_invalid_output: p(502, 'committed', 'confirm_new_turn', true),
  llm_unavailable: p(503, 'committed', 'confirm_new_turn', true), dependency_unavailable: p(503, 'recoverable', 'retry_same_request', false, true),
  storage_retryable: p(503, 'recoverable', 'get_request', false, true), outcome_unknown: p(503, 'unknown', 'get_request', false, true),
  internal_error: p(500, 'committed', 'contact_support'), internal_error_unaccepted: p(500, 'not_accepted', 'contact_support'), processing_expired: p(503, 'committed', 'get_state_and_confirm', true),
  request_expired: p(410, 'expired', 'get_state_and_confirm', true), plan_unavailable: p(404, 'not_accepted', 'confirm_new_turn', true),
});
export function mapU1Error(code: SemanticErrorCode, llmDecision: 'retryable' | 'exhausted' | 'unavailable'): { code: ErrorCode; policy: ErrorPolicy } {
  const mapped: ErrorCode = code === 'llm_timeout' || code === 'llm_unavailable'
    ? (llmDecision === 'retryable' ? 'llm_retryable' : llmDecision === 'exhausted' ? 'llm_budget_exhausted' : 'llm_unavailable') : code;
  return { code: mapped, policy: code === 'invalid_request' ? { ...ERROR_POLICIES[mapped], outcome: 'committed' } : { ...ERROR_POLICIES[mapped] } };
}