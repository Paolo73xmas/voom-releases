// In-memory store implementing the AGREED specification (U2-b rev.2.1 semantics). L1 only. The SQL store is the reference:
// a divergence found by the conformance suite is documented, never patched here to match an SQL defect.
import { type BeginLlmResult, type ClaimResult, type CommitResult, type PlanView, type Receipt, type RecoveredWork, type SemanticStore, type SessionView, StoreError, type TrustedCaller } from './store-port.ts';
import { sqlTerminalTurn } from './responses.ts';
const MIN = 60000, DAY = 86400000, LEASE_MS = 45000, PROCESSING_MS = 5 * MIN, REPLAY_MS = 7 * DAY, SESSION_MS = 30 * DAY, UNUSED_MS = 24 * 3600000;
const ts = (ms: number) => new Date(ms).toISOString();
interface S { sessionId: string; ownerUid: string; agentId: string; revision: number; state: Record<string, unknown>; operational: Record<string, unknown>; contractVersion: string; engineVersion: string; createdAt: number; lastCommitAt: number | null; expiresAt: number; lastPlanId: string | null }
interface R { sessionId: string; requestId: string; payloadHash: string; status: 'pending' | 'done' | 'expired'; baseRevision: number; acceptedAt: number; processingDeadline: number; responseExpiresAt: number; attempts: number; leaseToken: string | null; leaseUntil: number | null; nextRetryAt: number | null; context: unknown | null; llmOutput: unknown | null; reserved: number; httpStatus: number | null; outcome: string | null; body: string | null; finalRevision: number | null; planId: string | null; invocations: Array<{ invocationId: string; ordinal: number; outcome: string | null }> }
export interface MemoryStoreOptions { now: () => number; authorized: (uid: string, agentId: string) => boolean; uuid?: () => string }
export function makeMemoryStore(o: MemoryStoreOptions): SemanticStore & { sessions: Map<string, S>; requests: Map<string, R>; plans: Map<string, PlanView & { ownerUid: string; expiresAt: string }> } {
  const sessions = new Map<string, S>(), requests = new Map<string, R>(), plans = new Map<string, PlanView & { ownerUid: string; expiresAt: string }>();
  const uuid = o.uuid ?? (() => crypto.randomUUID());
  const key = (s: string, r: string) => `${s}|${r}`;
  const err = (code: string, http: number, msg: string) => new StoreError(code, http, msg);
  const receipt = (r: R): Receipt => ({ requestId: r.requestId, status: r.status, httpStatus: r.httpStatus, requestOutcome: r.outcome, body: r.body, baseRevision: r.baseRevision, finalRevision: r.finalRevision,
    planId: r.planId, acceptedAt: ts(r.acceptedAt), processingDeadline: ts(r.processingDeadline), responseExpiresAt: ts(r.responseExpiresAt), llmDispatchesReserved: r.reserved });
  function lockSession(c: TrustedCaller, sid: string): S {
    const s = sessions.get(sid), now = o.now();
    if (!s || s.ownerUid !== c.uid || !o.authorized(c.uid, s.agentId)) throw err('PT404', 404, 'not found');
    if (now >= s.expiresAt || (s.lastCommitAt === null && now >= s.createdAt + UNUSED_MS && ![...requests.values()].some(r => r.sessionId === sid))) throw err('PT410', 410, 'session expired');
    return s;
  }
  function lockFenced(c: TrustedCaller, sid: string, rid: string, token: string): R {
    lockSession(c, sid);
    const r = requests.get(key(sid, rid)), now = o.now();
    if (!r) throw err('PT404', 404, 'not found');
    if (r.status !== 'pending') throw err('PT409', 409, 'request already finalized');
    if (!token || r.leaseToken !== token) throw err('PT409', 409, 'stale or unknown token');
    if (r.leaseUntil === null || now >= r.leaseUntil || now >= r.processingDeadline) throw err('PT409', 409, 'lease or deadline expired');
    return r;
  }
  const finalize = (r: R, http: number, outcome: string, body: string, finalRevision: number | null, planId: string | null = null) =>
    Object.assign(r, { status: 'done' as const, httpStatus: http, outcome, body, finalRevision, planId, leaseToken: null, leaseUntil: null, nextRetryAt: null, context: null, llmOutput: null });
  function align(body: Record<string, unknown>, r: R, s: S, rev: number): Record<string, unknown> {
    if (!body || typeof body !== 'object' || body.operation !== 'turn' || body.contractVersion !== s.contractVersion || body.sessionId !== s.sessionId || body.requestId !== r.requestId
      || typeof body.outcome !== 'string' || body.outcome === 'not_accepted' || !('errorCode' in body) || !('nextAction' in body) || !('retryableSameRequest' in body)) throw err('PT422', 422, 'body not aligned');
    const b: Record<string, unknown> = { ...body, engineVersion: s.engineVersion, sessionRevision: rev, acceptedAt: ts(r.acceptedAt), responseExpiresAt: ts(r.responseExpiresAt) };
    if (b.result && typeof b.result === 'object') b.result = { ...(b.result as Record<string, unknown>), revision: rev, sessionId: s.sessionId, requestId: r.requestId };
    return b;
  }
  return {
    sessions, requests, plans,
    async createSession(c, agentId, cv, ev) {
      if (!o.authorized(c.uid, agentId) || (agentId !== c.uid && !o.authorized(c.uid, agentId))) throw err('PT403', 403, 'agent not authorized');
      const now = o.now(), s: S = { sessionId: uuid(), ownerUid: c.uid, agentId, revision: 0, state: {}, operational: {}, contractVersion: cv, engineVersion: ev, createdAt: now, lastCommitAt: null, expiresAt: now + SESSION_MS, lastPlanId: null };
      sessions.set(s.sessionId, s); return { sessionId: s.sessionId, agentId, revision: 0, expiresAt: ts(s.expiresAt) };
    },
    async claim(c, sid, rid, hash, expected) {
      const s = lockSession(c, sid); const k = key(sid, rid); let r = requests.get(k); const now = o.now();
      if (!r) {
        r = { sessionId: sid, requestId: rid, payloadHash: hash, status: 'pending', baseRevision: expected, acceptedAt: now, processingDeadline: now + PROCESSING_MS, responseExpiresAt: now + REPLAY_MS, attempts: 1, leaseToken: uuid(), leaseUntil: now + LEASE_MS, nextRetryAt: null, context: null, llmOutput: null, reserved: 0, httpStatus: null, outcome: null, body: null, finalRevision: null, planId: null, invocations: [] };
        requests.set(k, r); return { outcome: 'new', token: r.leaseToken!, currentRevision: s.revision, ...receipt(r) };
      }
      if (r.payloadHash !== hash) return { outcome: 'reused', currentRevision: s.revision, ...receipt(r) };
      if (r.status === 'expired' || now >= r.responseExpiresAt) { if (r.status === 'done') { r.status = 'expired'; r.body = null; } return { outcome: 'expired', currentRevision: s.revision, ...receipt(r) }; }
      if (r.status === 'done') return { outcome: 'cached', currentRevision: s.revision, ...receipt(r) };
      if (now >= r.processingDeadline) { finalize(r, 503, 'processing_expired', JSON.stringify(sqlTerminalTurn({ requestId: rid, acceptedAt: ts(r.acceptedAt), responseExpiresAt: ts(r.responseExpiresAt) }, s, 'processing_expired')), s.revision); return { outcome: 'deadline_finalized', currentRevision: s.revision, ...receipt(r) }; }
      if ((r.leaseUntil !== null && r.leaseUntil > now) || (r.nextRetryAt !== null && r.nextRetryAt > now)) return { outcome: 'in_progress', currentRevision: s.revision, retryAfterMs: Math.max(250, Math.max(r.leaseUntil ?? now, r.nextRetryAt ?? now) - now), ...receipt(r) };
      r.leaseToken = uuid(); r.leaseUntil = now + LEASE_MS; r.nextRetryAt = null; r.attempts++;
      return { outcome: 'takeover', token: r.leaseToken, processingAttempts: r.attempts, currentRevision: s.revision, ...receipt(r) };
    },
    async renewLease(c, sid, rid, t) { const r = lockFenced(c, sid, rid, t); r.leaseUntil = Math.min(o.now() + LEASE_MS, r.processingDeadline); return { ok: true, leaseUntil: ts(r.leaseUntil), processingDeadline: ts(r.processingDeadline) }; },
    async storeContext(c, sid, rid, t, ctx) { const r = lockFenced(c, sid, rid, t); if (r.context !== null) return { alreadyStored: true }; if (ctx === null || ctx === undefined) throw err('PT422', 422, 'context required'); r.context = JSON.parse(JSON.stringify(ctx)); return { alreadyStored: false }; },
    async beginLlm(c, sid, rid, t, inv): Promise<BeginLlmResult> {
      const r = lockFenced(c, sid, rid, t);
      if (r.context === null) throw err('PT409', 409, 'context must be stored before any reservation');
      if (r.invocations.some(i => i.invocationId === inv)) return { mayDispatch: false, alreadyReserved: true, reserved: r.reserved };
      if (r.llmOutput !== null) return { mayDispatch: false, outputStored: true, reserved: r.reserved };
      if (r.reserved >= 2) return { mayDispatch: false, budgetExhausted: true, reserved: r.reserved };
      r.invocations.push({ invocationId: inv, ordinal: r.reserved + 1, outcome: null }); r.reserved++;
      return { mayDispatch: true, alreadyReserved: false, reserved: r.reserved };
    },
    async storeLlm(c, sid, rid, t, inv, out) {
      const r = lockFenced(c, sid, rid, t); const i = r.invocations.find(x => x.invocationId === inv);
      if (!i) throw err('PT409', 409, 'output without reservation');
      if (r.llmOutput !== null) return { alreadyStored: true };
      if (out === null || out === undefined) throw err('PT422', 422, 'output required');
      r.llmOutput = JSON.parse(JSON.stringify(out)); i.outcome = 'stored'; return { alreadyStored: false };
    },
    async recoverWork(c, sid, rid, t): Promise<RecoveredWork> {
      const r = lockFenced(c, sid, rid, t);
      return { requestId: rid, baseRevision: r.baseRevision, processingAttempts: r.attempts, processingDeadline: ts(r.processingDeadline), leaseUntil: ts(r.leaseUntil!), llmDispatchesReserved: r.reserved, context: r.context, llmOutput: r.llmOutput, invocations: r.invocations.map(i => ({ ...i })) };
    },
    async commitSuccess(c, sid, rid, t, newState, operational, plan, body): Promise<CommitResult> {
      const r = lockFenced(c, sid, rid, t), s = sessions.get(sid)!, now = o.now();
      if (s.revision !== r.baseRevision) { finalize(r, 409, 'revision_conflict', JSON.stringify(sqlTerminalTurn({ requestId: rid, acceptedAt: ts(r.acceptedAt), responseExpiresAt: ts(r.responseExpiresAt) }, s, 'revision_conflict')), s.revision); return { outcome: 'revision_conflict', revision: s.revision, ...receipt(r) }; }
      if (newState === null || newState === undefined) throw err('PT422', 422, 'state required');
      const rev = s.revision + 1; let b = align(body, r, s, rev);
      if (b.outcome !== 'committed' || b.errorCode !== null) throw err('PT422', 422, 'commit_success requires a committed body without errorCode');
      let pid: string | null = null, stamped: Record<string, unknown> | null = null;
      if (plan !== null) {
        if (typeof plan !== 'object' || b.gate !== 'planned') throw err('PT422', 422, 'plan requires gate planned');
        pid = uuid(); stamped = { ...plan, planId: pid, sessionId: sid, sessionRevision: rev }; b = { ...b, plan: stamped };
      } else if ((b.plan && typeof b.plan === 'object') || b.gate === 'planned') throw err('PT422', 422, 'a plan in the body must be persisted through p_plan');
      Object.assign(s, { revision: rev, state: JSON.parse(JSON.stringify(newState)), operational: { ...(operational as Record<string, unknown> ?? s.operational), ...(pid ? { lastPlanId: pid, planRevision: rev } : {}) }, lastPlanId: pid ?? s.lastPlanId, lastCommitAt: now, expiresAt: now + SESSION_MS });
      if (pid) plans.set(pid, { planId: pid, sessionId: sid, planRevision: rev, plan: stamped!, createdAt: ts(now), expiresAt: ts(Math.min(now + SESSION_MS, s.expiresAt)), ownerUid: s.ownerUid });
      finalize(r, 200, 'committed', JSON.stringify(b), rev, pid);
      return { outcome: 'committed', revision: rev, ...receipt(r), planId: pid };
    },
    async finishError(c, sid, rid, t, http, body) {
      const r = lockFenced(c, sid, rid, t), s = sessions.get(sid)!;
      if (!(http >= 400 && http <= 599)) throw err('PT422', 422, 'error http status required');
      const b = align(body, r, s, s.revision);
      if (b.errorCode === null || b.errorCode === undefined || (b.gate ?? null) !== null || (b.plan ?? null) !== null || (b.result && typeof b.result === 'object' && (b.result as Record<string, unknown>).status !== 'error')) throw err('PT422', 422, 'finish_error requires an errorCode without gate/plan');
      finalize(r, http, String(b.errorCode), JSON.stringify(b), s.revision); return receipt(r);
    },
    async releaseRecoverable(c, sid, rid, t, _code, ms) { const r = lockFenced(c, sid, rid, t), now = o.now(); r.leaseUntil = now; r.nextRetryAt = Math.min(now + Math.min(Math.max(ms ?? 0, 0), 60000), r.processingDeadline); return { nextRetryAt: ts(r.nextRetryAt), status: r.status }; },
    async getState(c, sid): Promise<SessionView> { const s = lockSession(c, sid); return { sessionId: sid, agentId: s.agentId, revision: s.revision, state: s.state, operational: s.operational, lastPlanId: s.lastPlanId, contractVersion: s.contractVersion, expiresAt: ts(s.expiresAt), lastCommitAt: s.lastCommitAt === null ? null : ts(s.lastCommitAt) }; },
    async getRequest(c, sid, rid) { lockSession(c, sid); const r = requests.get(key(sid, rid)); if (!r) throw err('PT404', 404, 'not found'); if (r.status === 'expired' || o.now() >= r.responseExpiresAt) throw err('PT410', 410, 'request expired'); return receipt(r); },
    async getPlan(c, pid) { const p = plans.get(pid); if (!p || p.ownerUid !== c.uid) throw err('PT404', 404, 'not found'); lockSession(c, p.sessionId); if (o.now() >= Date.parse(p.expiresAt)) throw err('PT410', 410, 'plan expired'); const { ownerUid: _o, ...view } = p; void _o; return view; },
  };
}
