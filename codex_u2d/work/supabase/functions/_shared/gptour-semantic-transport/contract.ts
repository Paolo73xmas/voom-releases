// U2-a: shared transport types only. No I/O, auth, persistence or planner implementation.
import type { ConsentKind, PublicQuestion, SemanticAction, SemanticCriteria, SemanticResult } from '../gptour-semantic/contract.ts';
import type { DataQuality, GeoPoint, Plan } from '../gptour-orchestrator/contract.ts';
/** Served transport contract. semantic-1.2 (D-U2C-02): error identity nullable in not_accepted errors, correlationId, internal_error_unaccepted.
 *  NOT automatically compatible with semantic-1.1 clients: 1.1 requests are refused (unsupported_contract); 1.1 bodies remain VALIDATABLE as proofs of the previous version. */
export const TRANSPORT_VERSION = 'semantic-1.2' as const;
export const PREVIOUS_TRANSPORT_VERSIONS = ['semantic-1.1'] as const;
export const VALIDATABLE_TRANSPORT_VERSIONS = [...PREVIOUS_TRANSPORT_VERSIONS, TRANSPORT_VERSION] as const;
export type TransportVersion = typeof VALIDATABLE_TRANSPORT_VERSIONS[number];
export const TRANSPORT_ENGINE = 'gptour-semantic-transport/u2-a' as const;
/** Provisional TEST parameters; not approval of real cost or production retention. */
export const PROVISIONAL = Object.freeze({ leaseSeconds: 45, renewalSeconds: 15, llmTimeoutMs: 12000,
  maxLlmDispatches: 2, processingSeconds: 300, replayDays: 7, sessionDays: 30, unusedSessionHours: 24 });
export type ClientInfo = { platform: 'web' | 'mobile'; appVersion?: string };
export interface GpsInput { lat: number; lng: number; accuracyM: number; capturedAt: string }
export type TransportAction = Exclude<SemanticAction, { type: 'grant_consent' }> |
  { type: 'grant_consent'; kind: ConsentKind; questionId: string; dates?: string[] };
interface Base { contractVersion: typeof TRANSPORT_VERSION; client?: ClientInfo }
export interface TurnBase extends Base {
  operation: 'turn'; sessionId: string; requestId: string; expectedRevision: number;
  targetAgentId?: string; departure?: GeoPoint; gps?: GpsInput;
}
export type TurnRequest = TurnBase & ({ message: string; action?: never } | { action: TransportAction; message?: never });
export type TransportRequest =
  | (Base & { operation: 'capabilities' })
  | (Base & { operation: 'create_session'; targetAgentId?: string })
  | TurnRequest
  | (Base & { operation: 'get_state'; sessionId: string })
  | (Base & { operation: 'get_request'; sessionId: string; requestId: string })
  | (Base & { operation: 'get_plan'; sessionId: string; planId: string });
export type OperationName = TransportRequest['operation'];
export type Gate = 'pending_question' | 'blocked' | 'needs_consent' | 'planned';
export type Outcome = 'committed' | 'recoverable' | 'unknown' | 'not_accepted' | 'expired';
export type NextAction = 'none' | 'correct_request' | 'update_client' | 'authenticate' | 'restore_access' |
  'retry_same_request' | 'get_request' | 'get_state_and_confirm' | 'create_session_and_confirm' | 'confirm_new_turn' | 'contact_support';
export type ErrorCode = 'invalid_request' | 'unsupported_contract' | 'unauthenticated' | 'pilot_not_enabled' |
  'forbidden_agent' | 'forbidden_session' | 'agent_mismatch' | 'service_disabled' | 'access_unavailable' |
  'session_unavailable' | 'request_id_reused' | 'request_in_progress' | 'lease_lost' | 'revision_conflict' |
  'unknown_question' | 'context_changed' | 'engine_changed' | 'llm_retryable' | 'llm_budget_exhausted' |
  'llm_invalid_output' | 'llm_unavailable' | 'dependency_unavailable' | 'storage_retryable' | 'outcome_unknown' |
  'internal_error' | 'internal_error_unaccepted' | 'processing_expired' | 'request_expired' | 'plan_unavailable';
export interface ErrorPolicy { httpStatus: number; outcome: Outcome; retryableSameRequest: boolean; nextAction: NextAction; userConfirmation: boolean }
export interface OperationalContext {
  departure: GeoPoint | null; departureSource: 'explicit' | 'gps' | 'settings' | null; acquiredAt: string | null;
  gps: GpsInput | null; lastPlanId: string | null; planRevision: number | null;
}
export interface StateSnapshot {
  sessionId: string; sessionRevision: number; criteria: SemanticCriteria; question: PublicQuestion | null;
  openQuestions: PublicQuestion[]; openQuestionCount: number; notices: string[]; gate: Gate | null;
  context: OperationalContext; expiresAt: string; contractVersion: typeof TRANSPORT_VERSION; engineVersion: string;
}
export interface TurnResponse {
  operation: 'turn'; contractVersion: typeof TRANSPORT_VERSION; engineVersion: string;
  /** Identity as RECEIVED and valid; null only when absent/non-canonical (not_accepted errors only). A present identifier does not imply the resource exists or is accessible. */
  sessionId: string | null; requestId: string | null; sessionRevision: number | null; outcome: Outcome; errorCode: ErrorCode | null;
  /** Identifies THIS error occurrence (logs/support). Never a sessionId/requestId, never usable for replay. Required on not_accepted errors; absent on success. */
  correlationId?: string | null;
  retryableSameRequest: boolean; nextAction: NextAction; retryAfterMs: number | null;
  acceptedAt: string | null; responseExpiresAt: string | null;
  result: (Omit<SemanticResult, 'contractVersion'> & { contractVersion: typeof TRANSPORT_VERSION }) | null;
  gate: Gate | null; plan: Plan | null; openQuestions: PublicQuestion[]; openQuestionCount: number;
  notApplied: Array<{ reason: string; criterion: string }>; dataQuality: DataQuality | null;
}
export type TransportResponse = TurnResponse
  | { operation: 'capabilities'; contractVersion: typeof TRANSPORT_VERSION; engineVersion: string; operations: OperationName[]; enabled: boolean; supportedVersions: string[]; previousVersions: string[] }
  | { operation: 'create_session'; contractVersion: typeof TRANSPORT_VERSION; state: StateSnapshot }
  | { operation: 'get_state'; contractVersion: typeof TRANSPORT_VERSION; state: StateSnapshot }
  | { operation: 'get_plan'; contractVersion: typeof TRANSPORT_VERSION; plan: Plan; expiresAt: string; isCurrentRevision: boolean }
  | { operation: 'get_request'; contractVersion: typeof TRANSPORT_VERSION; sessionId: string; requestId: string;
      receipt: { status: 'not_found' | 'pending' | 'done' | 'expired'; processingExpired: boolean; recoverable: boolean;
        processingDeadline: string | null; responseExpiresAt: string | null; retryAfterMs: number | null;
        originalHttpStatus: number | null; response: TurnResponse | null } };
export interface ValidationIssue { path: string; rule: string }
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; httpStatus: 400; errorCode: 'invalid_request' | 'unsupported_contract'; issues: ValidationIssue[] };