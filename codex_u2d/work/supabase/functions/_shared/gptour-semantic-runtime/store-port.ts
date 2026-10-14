// U2-c store contract: typed mirror of the 13 U2-b RPCs. The trusted caller comes ONLY from verified auth (never from the payload).
export interface TrustedCaller { readonly uid: string }
export class StoreError extends Error {
  constructor(readonly sqlstate: string, readonly httpStatus: number, message: string) { super(message); }
  get uncertain(): boolean { return this.sqlstate === 'NET'; } // request sent, answer lost: never assume rollback
}
export interface Receipt {
  requestId: string; status: 'pending' | 'done' | 'expired'; httpStatus: number | null; requestOutcome: string | null; body: string | null;
  baseRevision: number; finalRevision: number | null; planId: string | null; acceptedAt: string; processingDeadline: string; responseExpiresAt: string; llmDispatchesReserved: number;
}
export type ClaimResult = Receipt & { currentRevision: number } & (
  | { outcome: 'new'; token: string } | { outcome: 'takeover'; token: string; processingAttempts: number }
  | { outcome: 'in_progress'; retryAfterMs: number } | { outcome: 'cached' | 'reused' | 'expired' | 'deadline_finalized' });
export interface RecoveredWork {
  requestId: string; baseRevision: number; processingAttempts: number; processingDeadline: string; leaseUntil: string; llmDispatchesReserved: number;
  context: unknown | null; llmOutput: unknown | null; invocations: Array<{ invocationId: string; ordinal: number; outcome: string | null }>;
}
export interface BeginLlmResult { mayDispatch: boolean; alreadyReserved?: boolean; outputStored?: boolean; budgetExhausted?: boolean; reserved: number }
export type CommitResult = Receipt & ({ outcome: 'committed'; revision: number; planId: string | null } | { outcome: 'revision_conflict'; revision: number });
export interface SessionView { sessionId: string; agentId: string; revision: number; state: Record<string, unknown>; operational: Record<string, unknown>; lastPlanId: string | null; contractVersion: string; expiresAt: string; lastCommitAt: string | null }
export interface PlanView { planId: string; sessionId: string; planRevision: number; plan: Record<string, unknown>; createdAt: string; expiresAt: string }
export interface SemanticStore {
  createSession(c: TrustedCaller, agentId: string, contractVersion: string, engineVersion: string): Promise<{ sessionId: string; agentId: string; revision: number; expiresAt: string }>;
  claim(c: TrustedCaller, sessionId: string, requestId: string, payloadHash: string, expectedRevision: number): Promise<ClaimResult>;
  renewLease(c: TrustedCaller, sessionId: string, requestId: string, token: string): Promise<{ ok: true; leaseUntil: string; processingDeadline: string }>;
  storeContext(c: TrustedCaller, sessionId: string, requestId: string, token: string, context: unknown): Promise<{ alreadyStored: boolean }>;
  beginLlm(c: TrustedCaller, sessionId: string, requestId: string, token: string, invocationId: string): Promise<BeginLlmResult>;
  storeLlm(c: TrustedCaller, sessionId: string, requestId: string, token: string, invocationId: string, output: unknown): Promise<{ alreadyStored: boolean }>;
  recoverWork(c: TrustedCaller, sessionId: string, requestId: string, token: string): Promise<RecoveredWork>;
  commitSuccess(c: TrustedCaller, sessionId: string, requestId: string, token: string, newState: unknown, operational: unknown | null, plan: Record<string, unknown> | null, body: Record<string, unknown>): Promise<CommitResult>;
  finishError(c: TrustedCaller, sessionId: string, requestId: string, token: string, httpStatus: number, body: Record<string, unknown>): Promise<Receipt>;
  releaseRecoverable(c: TrustedCaller, sessionId: string, requestId: string, token: string, errorCode: string, retryAfterMs: number): Promise<{ nextRetryAt: string | null; status: string }>;
  getState(c: TrustedCaller, sessionId: string): Promise<SessionView>;
  getRequest(c: TrustedCaller, sessionId: string, requestId: string): Promise<Receipt>;
  getPlan(c: TrustedCaller, planId: string): Promise<PlanView>;
}
export const RPC_NAMES = ['create_session', 'claim', 'renew_lease', 'store_context', 'begin_llm', 'store_llm', 'recover_work', 'commit_success', 'finish_error', 'release_recoverable', 'get_state', 'get_request', 'get_plan'] as const;
