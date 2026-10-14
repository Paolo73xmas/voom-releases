// D-U2C-03: planner infeasibility → persisted clarification scoped on the criterion the planner identified. The server NEVER edits criteria.
// Resolution map (criterion → operations that resolve the question) is explicit and tested; 'other' resolves on ANY reformulation, dismiss or reset.
import type { Operation, PendingQuestion, SemanticState } from '../gptour-semantic/contract.ts';
import { makeOp } from '../gptour-semantic/interpreter.ts';
import { slotOf } from '../gptour-semantic/apply.ts';
import type { PlanningGate } from '../gptour-semantic/projection.ts';
import { canonicalJson } from './canonical.ts';
import type { InfeasibleCriterion, PlannerResult } from './ports.ts';
export interface LastInfeasible { criterion: InfeasibleCriterion; fingerprint: string; questionId: string }
const MARK = 'gate:infeasible:';
export const criteriaFingerprint = (s: SemanticState): string => canonicalJson({ ...s.criteria, consents: undefined });
/** Operations (by U1 slot) that resolve an infeasible question for each criterion. */
export const RESOLVES: Record<InfeasibleCriterion, (op: Operation) => boolean> = {
  area: op => slotOf(op) === 'area',
  dates: op => slotOf(op) === 'f:dates',
  time_window: op => slotOf(op) === 'f:start_time' || slotOf(op) === 'f:end_time',
  visit_filter: op => slotOf(op) === 'segments',
  lodging: op => slotOf(op) === 'f:lodging',
  other: () => true,
};
const HINT: Record<InfeasibleCriterion, string> = {
  area: 'Indica altre località o un\'area diversa.', dates: 'Indica un\'altra data oppure rimuovi la data.', time_window: 'Modifica l\'orario di inizio o di fine (oppure rimuovine uno).',
  visit_filter: 'Modifica o rimuovi il filtro visite.', lodging: 'Modifica o rimuovi il vincolo di pernottamento.', other: 'Riformula la richiesta oppure annulla questa domanda per riprovare con i criteri attuali; puoi anche ricominciare da capo.',
};
const OPTIONS: Record<InfeasibleCriterion, PendingQuestion['options']> = {
  area: [], dates: [{ id: 'drop:dates', label: 'Rimuovi la data' }], time_window: [{ id: 'drop:start_time', label: 'Rimuovi l\'orario di inizio' }, { id: 'drop:end_time', label: 'Rimuovi l\'orario di fine' }],
  visit_filter: [{ id: 'drop:visit_filter', label: 'Rimuovi il filtro visite' }], lodging: [{ id: 'drop:lodging', label: 'Rimuovi il vincolo di pernottamento' }], other: [],
};
// Deferred op = U1 scope marker only (never re-applied). 'other' uses the '*' slot so U1 leaves the question open to everything but dismiss/reset; the runtime resolves it on any applied op.
const SCOPE_OP: Record<InfeasibleCriterion, Operation> = {
  area: makeOp({ op: 'replace_area' }), dates: makeOp({ op: 'set', field: 'dates' }), time_window: makeOp({ op: 'set', field: 'start_time' }),
  visit_filter: makeOp({ op: 'clear', field: 'visit_filter' }), lodging: makeOp({ op: 'set', field: 'lodging_mode' }), other: makeOp({ op: 'reset_all' }),
};
export const infeasibleCriterionOf = (q: PendingQuestion | null): InfeasibleCriterion | null => {
  const src = q?.deferred?.[0]?.source; const r = src && src.kind === 'server' ? src.reason : '';
  return r.startsWith(MARK) ? r.slice(MARK.length) as InfeasibleCriterion : null;
};
/** The question on top before the turn is an infeasible clarification still open after U1 and an applied op resolves it → pop it (runtime-managed resolution). */
export function popResolvedInfeasible(prevTop: PendingQuestion | null, state: SemanticState, applied: Operation[]): SemanticState {
  const c = infeasibleCriterionOf(prevTop);
  if (!c || !state.pendingQuestion || state.pendingQuestion.id !== prevTop!.id || !applied.some(RESOLVES[c])) return state;
  return { ...state, pendingQuestion: state.pendingQuestion.previous ?? null };
}
export function infeasibleGate(res: Extract<PlannerResult, { kind: 'infeasible' }>, state: SemanticState, last: LastInfeasible | null): { gate: Extract<PlanningGate<never>, { kind: 'blocked' }>; last: LastInfeasible } {
  const turn = state.turn + 1, fingerprint = criteriaFingerprint(state);
  const repeated = !!last && last.criterion === res.criterion && last.fingerprint === fingerprint; // informative only: modify/dismiss/reset remain available
  const text = `Nessun piano possibile: ${res.reason}. ${HINT[res.criterion]}${repeated ? ' (Criteri invariati rispetto al tentativo precedente.)' : ''}`;
  const question: PendingQuestion = { id: `q${turn}`, kind: 'invalid_value', text, options: OPTIONS[res.criterion], deferred: [{ op: SCOPE_OP[res.criterion], source: { kind: 'server', reason: MARK + res.criterion } }], opIndex: 0, consentKind: null, askedAtTurn: turn };
  return { gate: { kind: 'blocked', errorCode: 'unsupported_criteria', unsupported: [{ code: 'planner_infeasible', label: res.reason, clear: null }], question }, last: { criterion: res.criterion, fingerprint, questionId: question.id } };
}
