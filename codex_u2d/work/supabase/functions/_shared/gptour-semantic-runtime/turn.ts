// U2-c turn orchestration (plan rev.3 §U2-c). Pure runtime: no serve(), no auth parsing, no CRM/LLM/OSRM adapters.
// The trusted caller is injected by the (future U2-d) handler from verified auth; the payload never identifies the user.
// Every response leaving handle() is validated against semantic-1.1; internal SQL rows are never returned directly.
import type { PendingQuestion, SemanticState } from '../gptour-semantic/contract.ts';
import { proposeExpansion } from '../gptour-semantic/interpreter.ts';
import { guardPlanning, type PlanningGate } from '../gptour-semantic/projection.ts';
import { PREVIOUS_TRANSPORT_VERSIONS, PROVISIONAL, TRANSPORT_VERSION, type ErrorCode, type Gate, type TransportRequest, type TurnRequest, type TurnResponse, type ValidationIssue } from '../gptour-semantic-transport/contract.ts';
import { interpretCandidate } from '../gptour-semantic-transport/bridge.ts';
import { uuid as uuidCheck } from '../gptour-semantic-transport/checks.ts';
import { ERROR_POLICIES, mapU1Error } from '../gptour-semantic-transport/errors.ts';
import { openQuestions, projectResult, publicQuestion } from '../gptour-semantic-transport/public-projection.ts';
import { validateTransportResponse } from '../gptour-semantic-transport/response-validation.ts';
import { validateTransportRequest } from '../gptour-semantic-transport/validation.ts';
import { payloadHash } from './canonical.ts';
import { buildInterpretiveContext, isInterpretiveContext } from './interpretive-context.ts';
import { startLease } from './lease.ts';
import { gatedLlm, type GateOutcome } from './llm-gate.ts';
import { DependencyError, type InterpretiveContext, type PlannerResult, type TurnDeps } from './ports.ts';
import { committedTurn, errorTurn, receiptToGetRequest, type TurnIds } from './responses.ts';
import { isRefused, refusedGate, refusedProposal, withRefusal } from './refused-consent.ts';
import { infeasibleGate, popResolvedInfeasible, type LastInfeasible } from './infeasible-gate.ts';
import { persistedState, readSession, snapshotOf } from './session-state.ts';
import { type ClaimResult, StoreError, type TrustedCaller } from './store-port.ts';

type Accepted = { acceptedAt: string; responseExpiresAt: string; sessionRevision: number | null };
export interface TurnResult { http: number; body: Record<string, unknown>; diagnostics: { claim: ClaimResult['outcome'] | null; claimAttempted: boolean; llmReserved: number | null; llmDispatched: number; gate: GateOutcome[]; plannerCalls: number; accepted: Accepted | null; responseIssues: ValidationIssue[] | null } }
const V = PROVISIONAL;
const isUuid = (v: unknown) => { const e: ValidationIssue[] = []; uuidCheck(v, '$', e); return !e.length; };
/** Error identity (semantic-1.2, D-U2C-02): each identifier is kept separately when received and canonical; null otherwise. Nothing is fabricated. */
function identity(input: unknown, engineVersion: string): TurnIds {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return { sessionId: isUuid(i.sessionId) ? i.sessionId as string : null, requestId: isUuid(i.requestId) ? i.requestId as string : null, engineVersion };
}
const asBody = (b: unknown) => b as Record<string, unknown>;

export async function handle(input: unknown, caller: TrustedCaller, deps: TurnDeps): Promise<TurnResult> {
  const r = await dispatch(input, caller, deps);
  const v = validateTransportResponse(r.body);
  if (v.ok) return r;
  // Defect guard: a non-contractual body never leaves the runtime (a persisted outcome stays retrievable via get_request).
  // internal_error_unaccepted ONLY when it is certain that no request was accepted (no claim attempted); an attempted claim keeps the recoverable path.
  const ids = identity(input, deps.engineVersion), acc = r.diagnostics.accepted;
  const code: ErrorCode = acc ? 'internal_error' : r.diagnostics.claimAttempted ? 'outcome_unknown' : 'internal_error_unaccepted';
  return { http: ERROR_POLICIES[code].httpStatus, body: asBody(errorTurn(ids, code, acc, code === 'outcome_unknown' ? 1500 : null)), diagnostics: { ...r.diagnostics, responseIssues: v.issues } };
}

async function dispatch(input: unknown, caller: TrustedCaller, deps: TurnDeps): Promise<TurnResult> {
  const parsed = validateTransportRequest(input);
  const diag: TurnResult['diagnostics'] = { claim: null, claimAttempted: false, llmReserved: null, llmDispatched: 0, gate: [], plannerCalls: 0, accepted: null, responseIssues: null };
  const ids = identity(input, deps.engineVersion);
  const err = (code: ErrorCode, accepted: Accepted | null = null, retryAfterMs: number | null = null) => ({ http: ERROR_POLICIES[code].httpStatus, body: asBody(errorTurn(ids, code, accepted, retryAfterMs)), diagnostics: diag });
  if (!parsed.ok) return err(parsed.errorCode);
  const req: TransportRequest = parsed.value;
  try {
    switch (req.operation) {
      case 'capabilities': return { http: 200, body: { operation: 'capabilities', contractVersion: TRANSPORT_VERSION, engineVersion: deps.engineVersion, operations: ['capabilities', 'create_session', 'turn', 'get_state', 'get_request', 'get_plan'], enabled: true, supportedVersions: [TRANSPORT_VERSION], previousVersions: [...PREVIOUS_TRANSPORT_VERSIONS] }, diagnostics: diag };
      case 'create_session': {
        const s = await deps.store.createSession(caller, req.targetAgentId ?? caller.uid, TRANSPORT_VERSION, deps.engineVersion);
        const view = await deps.store.getState(caller, s.sessionId);
        return { http: 201, body: { operation: 'create_session', contractVersion: TRANSPORT_VERSION, state: snapshotOf(view, deps.engineVersion) }, diagnostics: diag };
      }
      case 'get_state': return { http: 200, body: { operation: 'get_state', contractVersion: TRANSPORT_VERSION, state: snapshotOf(await deps.store.getState(caller, req.sessionId), deps.engineVersion) }, diagnostics: diag };
      case 'get_plan': {
        const s = await deps.store.getState(caller, req.sessionId); // session authorization first (non-enumerating)
        let p; try { p = await deps.store.getPlan(caller, req.planId); } catch (e) { if (e instanceof StoreError && (e.sqlstate === 'PT404' || e.sqlstate === 'PT410')) return err('plan_unavailable'); throw e; }
        if (p.sessionId !== req.sessionId) return err('plan_unavailable'); // plan of ANOTHER session of the same user: rejected
        return { http: 200, body: { operation: 'get_plan', contractVersion: TRANSPORT_VERSION, plan: p.plan, expiresAt: p.expiresAt, isCurrentRevision: s.revision === p.planRevision }, diagnostics: diag };
      }
      case 'get_request': {
        let r = null; try { r = await deps.store.getRequest(caller, req.sessionId, req.requestId); } catch (e) { if (!(e instanceof StoreError && e.sqlstate === 'PT404')) throw e; }
        return { http: 200, body: asBody(receiptToGetRequest(req, r, deps.now())), diagnostics: diag };
      }
      case 'turn': return await turn(req, caller, deps, diag);
    }
  } catch (e) {
    if ((e as Error)?.name === 'WorkerCrash') throw e; // lab-only: simulated worker death must not be masked as a response
    if (e instanceof StoreError) {
      // Store failure DURING the claim (no outcome returned): acceptance is uncertain → outcome_unknown, recovery via get_request with the original identifiers.
      const claimLost = diag.claimAttempted && diag.claim === null && !e.sqlstate.startsWith('PT'); // a definitive SQL state (PTxxx) is not a lost response
      const code: ErrorCode = claimLost || e.uncertain ? 'outcome_unknown' : e.sqlstate === 'PT404' ? 'forbidden_session' : e.sqlstate === 'PT410' ? 'session_unavailable' : e.sqlstate === 'PT403' ? 'forbidden_agent' : 'storage_retryable';
      return err(code, diag.accepted, ERROR_POLICIES[code].retryableSameRequest ? 1500 : null);
    }
    // Lost response DURING the claim: the outcome is uncertain → recover via get_request with the ORIGINAL identifiers (never a new requestId).
    if (diag.claimAttempted) return err('outcome_unknown', null, 1500);
    return err('internal_error_unaccepted'); // certain: no claim was attempted, nothing was accepted
  }
}

/** Gate questions are server truth: persisted in the session state and returned as openQuestions, with ONE revision per turn (never a second increment). */
function withGate(u1: SemanticState, g: PlanningGate<unknown>): SemanticState {
  if (g.kind === 'needs_consent') return { ...proposeExpansion(u1, g.proposal, g.text), revision: u1.revision };
  if (g.kind !== 'blocked') return u1;
  const q: PendingQuestion = { ...g.question, previous: u1.pendingQuestion ?? null };
  return { ...u1, turn: q.askedAtTurn, pendingQuestion: q, history: [...u1.history, { role: 'assistant' as const, text: q.text }].slice(-20) };
}

async function turn(req: TurnRequest, caller: TrustedCaller, deps: TurnDeps, diag: TurnResult['diagnostics']): Promise<TurnResult> {
  const ids: TurnIds = { sessionId: req.sessionId, requestId: req.requestId, engineVersion: deps.engineVersion };
  const out = (http: number, body: unknown) => ({ http, body: asBody(body), diagnostics: diag });
  const hash = await payloadHash(req as unknown as Record<string, unknown>);
  deps.crash?.('C1');
  diag.claimAttempted = true;
  const claim = await deps.store.claim(caller, req.sessionId, req.requestId, hash, req.expectedRevision);
  diag.claim = claim.outcome; diag.llmReserved = claim.llmDispatchesReserved;
  const accepted: Accepted = { acceptedAt: claim.acceptedAt, responseExpiresAt: claim.responseExpiresAt, sessionRevision: claim.currentRevision };
  if (claim.outcome !== 'reused') diag.accepted = accepted; // any other outcome proves an accepted request exists
  if (claim.outcome === 'cached' || claim.outcome === 'deadline_finalized') return out(claim.httpStatus!, JSON.parse(claim.body!));
  if (claim.outcome === 'reused') return out(422, errorTurn(ids, 'request_id_reused', null));
  if (claim.outcome === 'expired') return out(410, errorTurn(ids, 'request_expired', accepted));
  if (claim.outcome === 'in_progress') return out(409, errorTurn(ids, 'request_in_progress', accepted, claim.retryAfterMs));
  if (claim.outcome !== 'new' && claim.outcome !== 'takeover') return out(503, errorTurn(ids, 'storage_retryable', accepted, 1500));
  const token = claim.token;
  const lease = startLease(deps.store, caller, req.sessionId, req.requestId, token, { now: deps.now, intervalMs: deps.leaseIntervalMs ?? V.renewalSeconds * 1000, deadlineMs: Date.parse(claim.processingDeadline), executionBudgetMs: deps.executionBudgetMs, initialLeaseMs: V.leaseSeconds * 1000 });
  const finishError = async (code: ErrorCode, http = ERROR_POLICIES[code].httpStatus) => {
    // U1 invalid_request after claim: 400 committed (D), the request is finalized and replayable.
    const r = await deps.store.finishError(caller, req.sessionId, req.requestId, token, http, asBody(errorTurn(ids, code, accepted, null, code === 'invalid_request' ? 'committed' : undefined)));
    return out(r.httpStatus!, JSON.parse(r.body!));
  };
  const release = async (code: ErrorCode, retryAfterMs: number) => {
    await deps.store.releaseRecoverable(caller, req.sessionId, req.requestId, token, code, retryAfterMs);
    return out(ERROR_POLICIES[code].httpStatus, errorTurn(ids, code, accepted, retryAfterMs));
  };
  try {
    deps.crash?.('C2');
    const recovered = claim.outcome === 'takeover' ? await deps.store.recoverWork(caller, req.sessionId, req.requestId, token) : null;
    // Interpretive context: stable only once persisted; before store_context a crash may legitimately observe a changed catalog (acceptedAt is DB-fixed).
    let ctx: InterpretiveContext;
    if (recovered && isInterpretiveContext(recovered.context)) ctx = recovered.context;
    else {
      const agentId = (await deps.store.getState(caller, req.sessionId)).agentId;
      const built = await buildInterpretiveContext({ acceptedAt: claim.acceptedAt, catalog: await deps.catalog.load(agentId), workingDays: await deps.settings.workingDays(agentId), engineVersion: deps.engineVersion, promptVersion: deps.promptVersion, model: deps.model });
      const st = await deps.store.storeContext(caller, req.sessionId, req.requestId, token, built);
      ctx = st.alreadyStored ? (await deps.store.recoverWork(caller, req.sessionId, req.requestId, token)).context as InterpretiveContext : built;
    }
    deps.crash?.('C3');
    const session = await deps.store.getState(caller, req.sessionId);
    if (session.revision !== claim.baseRevision) return await finishError('revision_conflict');
    const read = readSession(session);
    const prev: SemanticState = read.semantic, operational = read.operational;
    const gate = deps.llm ? gatedLlm(deps.llm, deps.store, caller, req.sessionId, req.requestId, token, recovered, { newId: deps.newId, ensureResidual: () => lease.ensureResidual((deps.llmTimeoutMs ?? V.llmTimeoutMs) + 5000) }) : null;
    const cand = await interpretCandidate(req, prev, { acceptedAt: ctx.acceptedAt, catalog: ctx.catalog, operational, llm: gate?.port ?? null, timeoutMs: deps.llmTimeoutMs ?? V.llmTimeoutMs });
    if (gate) { diag.gate = gate.outcomes; diag.llmDispatched = gate.dispatches; }
    if (cand.kind === 'rejected') return await finishError(cand.errorCode, cand.httpStatus);
    const u1 = cand.u1;
    if (u1.result.status === 'error') {
      const code = u1.result.errorCode!;
      const last = gate?.outcomes.at(-1);
      if (code === 'llm_timeout' || code === 'llm_unavailable') {
        if (!gate) return await finishError('llm_unavailable');
        if (last?.kind === 'reservation_uncertain' || last?.kind === 'store_failed') return await release('storage_retryable', 1500);
        if (last?.kind === 'lease_short') return await release('lease_lost', 1000);
        if (last?.kind === 'budget_exhausted') return await finishError('llm_budget_exhausted');
        // Permanent provider fault (401/403/400, unstructured error): terminal, no automatic second call. Only structured transient faults and timeouts may retry.
        if (last?.kind === 'provider_error' && !last.retryable) return await finishError('llm_unavailable');
        const reserved = (await deps.store.recoverWork(caller, req.sessionId, req.requestId, token)).llmDispatchesReserved;
        const m = mapU1Error(code, reserved < V.maxLlmDispatches ? 'retryable' : 'exhausted');
        return m.policy.outcome === 'recoverable' ? await release(m.code, 2000) : await finishError(m.code);
      }
      return await finishError(mapU1Error(code, 'unavailable').code);
    }
    deps.crash?.('C6');
    const rv = await deps.revalidation.check({ state: u1.state, acceptedAt: ctx.acceptedAt, engineVersion: deps.engineVersion, contextEngineVersion: ctx.engineVersion, catalogHash: ctx.catalogHash });
    if (!rv.ok) return await finishError(rv.code);
    // D-U2C-03: an infeasible clarification resolved by this turn's applied operations is closed by the runtime (U1 left it open when the op hit a sibling slot, e.g. end_time).
    const u1State = popResolvedInfeasible(prev.pendingQuestion, u1.state, u1.result.applied);
    const g0 = await guardPlanning(u1State, ctx.catalog, p => { diag.plannerCalls++; return deps.planner.plan(p, { sessionId: req.sessionId, sessionRevision: claim.baseRevision + 1, acceptedAt: ctx.acceptedAt, operational: cand.operational }); },
      undefined, ctx.workingDays ? { workingDays: ctx.workingDays } : undefined);
    // Explicit "no" to a consent proposal is conserved per scope: the same authorization is never re-asked; the gate blocks with a clarification (date unchanged).
    const declined = withRefusal(read.declined, refusedProposal(req, prev, u1.result.applied), u1State.turn, req.action?.type === 'reset');
    let lastInfeasible: LastInfeasible | null = null;
    let g: PlanningGate<PlannerResult> = g0.kind === 'needs_consent' && isRefused(declined, g0.proposal) ? refusedGate(g0.proposal, u1State) : g0;
    // Planner infeasible → persisted clarification scoped on the criterion the planner identified (criteria never edited by the server).
    if (g.kind === 'planned' && g.result.kind === 'infeasible') { const ig = infeasibleGate(g.result, u1State, read.lastInfeasible); g = ig.gate; lastInfeasible = ig.last; }
    const finalState = withGate(u1State, g);
    const questions = openQuestions(finalState.pendingQuestion);
    const notices = [...u1.result.notices, ...cand.notices];
    const result = { ...projectResult(u1.result), notices, question: finalState.pendingQuestion ? publicQuestion(finalState.pendingQuestion) : null };
    let plan: Record<string, unknown> | null = null, body: TurnResponse, gateKind: Gate;
    const base = { result, openQuestions: questions, notApplied: [] as Array<{ reason: string; criterion: string }>, dataQuality: null as TurnResponse['dataQuality'] };
    if (g.kind === 'planned') { plan = (g.result as Extract<PlannerResult, { kind: 'plan' }>).plan as unknown as Record<string, unknown>; gateKind = 'planned'; body = committedTurn(ids, { ...base, gate: gateKind, dataQuality: (g.result as Extract<PlannerResult, { kind: 'plan' }>).dataQuality }); }
    else if (lastInfeasible && g.kind === 'blocked') { gateKind = 'blocked'; body = committedTurn(ids, { ...base, gate: gateKind, notApplied: [{ reason: g.unsupported[0].label, criterion: lastInfeasible.criterion }] }); }
    else { gateKind = g.kind; body = committedTurn(ids, { ...base, gate: gateKind, notApplied: g.kind === 'blocked' ? g.unsupported.map(u => ({ reason: u.code, criterion: u.label })) : [] }); }
    const commit = await deps.store.commitSuccess(caller, req.sessionId, req.requestId, token, persistedState(finalState, gateKind, notices, declined, lastInfeasible), cand.operational, plan, asBody(body));
    deps.crash?.('C7');
    return out(commit.httpStatus!, JSON.parse(commit.body!)); // response re-read from the persisted receipt, never the in-memory candidate
  } catch (e) {
    if (e instanceof StoreError) {
      if (e.uncertain) return out(503, errorTurn(ids, 'outcome_unknown', accepted, 1500));
      if (e.sqlstate === 'PT409') return out(409, errorTurn(ids, 'lease_lost', accepted, 1000));
      if (e.sqlstate === 'PT404' || e.sqlstate === 'PT410') return out(ERROR_POLICIES[e.sqlstate === 'PT404' ? 'forbidden_session' : 'session_unavailable'].httpStatus, errorTurn(ids, e.sqlstate === 'PT404' ? 'forbidden_session' : 'session_unavailable', null));
      return out(503, errorTurn(ids, 'storage_retryable', accepted, 1500));
    }
    if ((e as Error)?.name === 'WorkerCrash') throw e;
    // Dependency (catalog/settings/planner/routing) failed: recoverable with the SAME requestId; never a fake empty result or a 'verified' plan.
    if (e instanceof DependencyError) { try { return await release('dependency_unavailable', 2000); } catch (e2) { if (e2 instanceof StoreError) return out(503, errorTurn(ids, e2.uncertain ? 'outcome_unknown' : 'storage_retryable', accepted, 1500)); throw e2; } }
    // Unexpected deterministic failure after acceptance: finalize as internal_error (D); if finalization itself fails the StoreError path above applies on retry.
    try { return await finishError('internal_error'); } catch (e2) { if (e2 instanceof StoreError) return out(503, errorTurn(ids, e2.uncertain ? 'outcome_unknown' : 'storage_retryable', accepted, 1500)); throw e2; }
  } finally { lease.stop(); }
}
