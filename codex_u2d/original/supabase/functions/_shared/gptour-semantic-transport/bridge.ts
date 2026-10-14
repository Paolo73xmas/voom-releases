// U2-a: IN-MEMORY candidate only, never a committed transport response.
// The caller supplies a trusted clock/catalog/state; no production LLM adapter is imported.
import { SEMANTIC_CONTRACT_VERSION, type ReferenceCatalog, type SemanticRequest, type SemanticState } from '../gptour-semantic/contract.ts';
import { interpretTurn, type LlmPort, type TurnOutcome } from '../gptour-semantic/interpreter.ts';
import { PROVISIONAL, type OperationalContext, type TurnRequest } from './contract.ts';
import { proposeOperationalContext } from './context.ts';
import { isTimestamp } from './checks.ts';
import { validateTransportRequest } from './validation.ts';

export function toU1Request(req: TurnRequest): SemanticRequest {
  const parsed = validateTransportRequest(req);
  if (!parsed.ok || parsed.value.operation !== 'turn') throw new Error('Invalid transport turn');
  const r = parsed.value;
  let action = r.action;
  if (action?.type === 'grant_consent') {
    const { questionId: _question, ...mapped } = action;
    void _question;
    return { contractVersion: SEMANTIC_CONTRACT_VERSION, sessionId: r.sessionId, requestId: r.requestId,
      expectedRevision: r.expectedRevision, action: mapped };
  }
  return { contractVersion: SEMANTIC_CONTRACT_VERSION, sessionId: r.sessionId, requestId: r.requestId,
    expectedRevision: r.expectedRevision, ...(action ? { action } : { message: r.message }) };
}
export interface CandidateContext { acceptedAt: string; catalog: ReferenceCatalog; operational: OperationalContext; llm: LlmPort | null; timeoutMs?: number }
export type BridgeCandidate = { kind: 'candidate'; persisted: false; u1: TurnOutcome; operational: OperationalContext; notices: string[] }
  | { kind: 'rejected'; persisted: false; httpStatus: 409; errorCode: 'unknown_question' | 'revision_conflict' }
  | { kind: 'rejected'; persisted: false; httpStatus: 410; errorCode: 'session_unavailable' };
export async function interpretCandidate(req: TurnRequest, previous: SemanticState, deps: CandidateContext): Promise<BridgeCandidate> {
  const mapped = toU1Request(req);
  if (!isTimestamp(deps.acceptedAt)) throw new Error('Invalid trusted acceptedAt');
  if (previous.sessionId !== req.sessionId) return { kind: 'rejected', persisted: false, httpStatus: 410, errorCode: 'session_unavailable' };
  if (previous.revision !== req.expectedRevision) return { kind: 'rejected', persisted: false, httpStatus: 409, errorCode: 'revision_conflict' };
  const a = req.action;
  if (a?.type === 'grant_consent') {
    const q = previous.pendingQuestion;
    if (!q || q.id !== a.questionId || q.kind !== 'consent' || q.consentKind !== a.kind ||
      (a.kind === 'non_working_day' && JSON.stringify([...(a.dates ?? [])].sort()) !== JSON.stringify([...(q.proposal?.dates ?? [])].sort()))) {
      return { kind: 'rejected', persisted: false, httpStatus: 409, errorCode: 'unknown_question' };
    }
  }
  const u1 = await interpretTurn(mapped, previous, deps.catalog, {
    llm: req.action ? null : deps.llm, clock: { nowIso: () => deps.acceptedAt }, timeoutMs: deps.timeoutMs ?? PROVISIONAL.llmTimeoutMs,
  });
  const next = u1.result.status === 'error' ? { context: JSON.parse(JSON.stringify(deps.operational)) as OperationalContext, notices: [] } :
    proposeOperationalContext(req, deps.operational, deps.acceptedAt);
  return { kind: 'candidate', persisted: false, u1, operational: next.context, notices: next.notices };
}