// Explicit refusal of a system consent proposal (answer "no"): conserved per scope (kind + exact dates/days) in the session state.
// A refused proposal is never re-asked automatically; the gate blocks with a clarification (change/clear the date) and the date is NEVER changed by the server.
import type { ConsentKind, ExpansionProposal, Operation, PendingQuestion, SemanticState } from '../gptour-semantic/contract.ts';
import { makeOp } from '../gptour-semantic/interpreter.ts';
import type { PlanningGate } from '../gptour-semantic/projection.ts';
import { isoDow } from '../gptour-orchestrator/time.ts';
import type { TurnRequest } from '../gptour-semantic-transport/contract.ts';
export interface DeclinedConsent { kind: ConsentKind; dates: string[] | null; days: number | null; turn: number }
const MAX_DECLINED = 20, WD = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const key = (kind: ConsentKind, dates: string[] | null | undefined, days: number | null | undefined) => `${kind}|${[...(dates ?? [])].sort().join(',')}|${days ?? ''}`;
/** The proposal on top of the stack is refused by the button ("no") OR by a textual decline_consent of the SAME kind that U1 actually
 *  applied (semantic-1.0.1: citation verified, pending consent matched, no grant/decline conflict). Rejected declines never count. */
export function refusedProposal(req: TurnRequest, prev: SemanticState, applied: Operation[]): ExpansionProposal | null {
  const q = prev.pendingQuestion, a = req.action;
  if (!q || q.kind !== 'consent' || !q.proposal) return null;
  if (a?.type === 'answer' && a.questionId === q.id && a.optionId === 'no') return q.proposal;
  if (!a && applied.some(op => op.op === 'decline_consent' && op.consent === q.consentKind)) return q.proposal;
  return null;
}
export function withRefusal(list: DeclinedConsent[], p: ExpansionProposal | null, turn: number, reset: boolean): DeclinedConsent[] {
  if (reset) return [];
  if (!p) return list;
  return [...list.filter(d => key(d.kind, d.dates, d.days) !== key(p.kind, p.dates, p.days)), { kind: p.kind, dates: p.dates ? [...p.dates].sort() : null, days: p.days ?? null, turn }].slice(-MAX_DECLINED);
}
export const isRefused = (list: DeclinedConsent[], p: ExpansionProposal): boolean => list.some(d => key(d.kind, d.dates, d.days) === key(p.kind, p.dates, p.days));
/** Blocked gate for a refused proposal: clarification scoped to the dates slot (a non-pertinent message keeps it open; a new date or drop:dates resolves it). */
export function refusedGate(p: ExpansionProposal, state: SemanticState): Extract<PlanningGate<never>, { kind: 'blocked' }> {
  const turn = state.turn + 1, dates = p.dates ?? [];
  const human = dates.map(d => `${WD[isoDow(d) - 1]} ${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ');
  const label = p.kind === 'non_working_day' ? `giorno non lavorativo rifiutato (${human})` : `autorizzazione «${p.kind}» rifiutata`;
  const text = p.kind === 'non_working_day'
    ? `Hai scelto di non includere ${human} (giorno non lavorativo): non pianifico su quella data e non la cambio da solo. Indica un'altra data per il giro oppure rimuovi la data.`
    : `Hai rifiutato l'autorizzazione «${p.kind}»: non la ripropongo. Modifica la richiesta oppure rimuovi la data del giro.`;
  const question: PendingQuestion = { id: `q${turn}`, kind: 'invalid_value', text, options: [{ id: 'drop:dates', label: 'Rimuovi la data del giro' }],
    deferred: [{ op: makeOp({ op: 'set', field: 'dates', dates: dates.length ? dates : null }), source: { kind: 'server', reason: 'gate:refused_consent' } }], opIndex: 0, consentKind: null, askedAtTurn: turn };
  return { kind: 'blocked', errorCode: 'unsupported_criteria', unsupported: [{ code: 'refused_consent', label, clear: 'dates' }], question };
}
