// Interprete semantico isolato: UN solo punto di interpretazione LLM per messaggio libero; azioni dei pulsanti senza LLM.
// Nessun accesso in scrittura a CRM/agenda/tour: riceve solo un catalogo di riferimenti in sola lettura.
import {
  SEMANTIC_CONTRACT_VERSION, type Operation, type PendingQuestion, type ReferenceCatalog, type SemanticAction, type SemanticErrorCode,
  type ClearField, type ConsentKind, type ExpansionProposal, type SourcedOp, type SemanticRequest, type SemanticResult, type SemanticState,
} from './contract.ts';
import { LLM_OUTPUT_SCHEMA, parseLlmText, validateLlmOutput } from './schema.ts';
import { applyOperations, changedPaths, evidenceOk, isAreaOp, slotOf, type ApplyOptions, type Issue } from './apply.ts';
import { buildSystemPrompt } from './prompt.ts';
import { isoDow, romeNow, minToTime } from '../gptour-orchestrator/time.ts';

export interface LlmCall { system: string; user: string; schema: typeof LLM_OUTPUT_SCHEMA; signal: AbortSignal }
export interface LlmPort { readonly model: string; complete(call: LlmCall): Promise<string> }
export interface InterpreterDeps { llm: LlmPort | null; clock: { nowIso(): string }; timeoutMs?: number }
export interface TurnOutcome { state: SemanticState; result: SemanticResult }

export const DEFAULT_LLM_TIMEOUT_MS = 12000;
class LlmTimeout extends Error {}

export function makeOp(p: Partial<Operation> & Pick<Operation, 'op'>): Operation {
  return { field: null, text: null, number: null, flag: null, dates: null, categories: null, allCategories: null, minDaysSinceOrder: null, minDaysSinceVisit: null,
    ownOnly: null, locality: null, provincia: null, refId: null, mention: null, decision: null, proposedDate: null, consent: null, evidence: '', ...p };
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export async function interpretTurn(req: SemanticRequest, prev: SemanticState, catalog: ReferenceCatalog, deps: InterpreterDeps): Promise<TurnOutcome> {
  const t0 = Date.now();
  const state = clone(prev);
  let llmCalls = 0, interpreter: SemanticResult['diagnostics']['interpreter'] = 'none';
  const result = (status: SemanticResult['status'], message: string, extra: Partial<SemanticResult> = {}): SemanticResult => ({
    contractVersion: SEMANTIC_CONTRACT_VERSION, sessionId: req.sessionId, requestId: req.requestId, status, revision: state.revision,
    criteria: state.criteria, changed: [], applied: [], rejected: [], question: null, errorCode: null, message, notices: [],
    diagnostics: { interpreter, llmCalls, model: llmCalls ? deps.llm?.model ?? null : null, ms: Date.now() - t0 }, ...extra,
  });
  /** Errore: stato precedente intatto (stessa revisione). */
  const fail = (code: SemanticErrorCode, message: string): TurnOutcome => ({ state: prev, result: { ...result('error', message, { errorCode: code }), revision: prev.revision, criteria: prev.criteria } });

  if (req.contractVersion !== SEMANTIC_CONTRACT_VERSION) return fail('unsupported_contract', `contractVersion non supportata (attesa ${SEMANTIC_CONTRACT_VERSION}).`);
  const hasMsg = typeof req.message === 'string' && req.message.trim().length > 0;
  if (hasMsg === !!req.action || (hasMsg && req.message!.length > 2000)) return fail('invalid_request', 'Serve un messaggio (max 2000 caratteri) oppure un\'azione, non entrambi.');
  if (req.expectedRevision !== prev.revision) return fail('revision_conflict', `Revisione non aggiornata (attesa ${prev.revision}): ricarica lo stato e riprova.`);

  const now = romeNow(deps.clock.nowIso());
  const ctx = { today: now.date, turn: prev.turn + 1, catalog, pending: prev.pendingQuestion };

  /** 'resolve' = il turno risponde alla domanda in cima (che si chiude, torna attiva la precedente);
   *  'side' = aggiornamento non pertinente: la domanda resta aperta, senza le operazioni sospese ora superate. */
  const commit = (items: SourcedOp[], opts: ApplyOptions = {}, mode: 'resolve' | 'side' = 'resolve'): TurnOutcome => {
    const open = prev.pendingQuestion;
    // Le operazioni di questo turno prevalgono su quelle sospese dello stesso ambito in TUTTA la pila: le sospese superate
    // vengono scartate e le domande il cui criterio è stato sostituito si chiudono (le loro altre operazioni restano sospese più in alto).
    const { stack: after, carry } = supersede(mode === 'resolve' ? (open?.previous ?? null) : open, new Set(items.map((x) => slotOf(x.op))));
    items = [...carry, ...items];
    const out = applyOperations(prev.criteria, items, ctx, opts);
    state.revision++; state.turn++;
    if (out.issues.length) {
      const q: PendingQuestion = { ...pendingFrom(out.issues[0], items, ctx.turn), previous: after };
      state.pendingQuestion = q;
      return done(result('needs_clarification', q.text + (after ? ` (Resta aperta anche: «${after.text}»)` : ''), { question: publicQ(q), rejected: out.issues.map((i) => ({ op: i.opIndex >= 0 ? items[i.opIndex].op.op : 'set', reason: i.reason })) }));
    }
    state.pendingQuestion = items.some((x) => x.op.op === 'reset_all') ? null : after;
    const changed = changedPaths(prev.criteria, out.criteria);
    state.criteria = out.criteria;
    const notices = out.invalidated.map(consentNotice);
    const still = state.pendingQuestion;
    const msg = [changed.length ? `Criteri aggiornati: ${changed.join(', ')}.` : 'Nessun criterio modificato.', ...notices, still ? `Resta aperta la domanda: ${still.text}` : ''].filter(Boolean).join(' ');
    return done(result('updated', msg, { changed, applied: out.applied, notices, question: still ? publicQ(still) : null }));
  };
  /** Instradamento comune a testo e pulsanti: risolve la domanda in cima solo se il nuovo input ne tocca l'ambito. */
  const route = (fresh: SourcedOp[], opts: ApplyOptions = {}): TurnOutcome => {
    const p = prev.pendingQuestion;
    if (!p) return commit(fresh, opts, 'side');
    const slot = problemSlot(p);
    const addresses = slot === null ? fresh.some((x) => x.source.kind === 'llm') : fresh.some((x) => { const k = slotOf(x.op); return k === '*' || k === slot; });
    if (!addresses) return commit(fresh, opts, 'side');
    const resumed = (p.deferred ?? []).filter((x, i) => i !== p.opIndex && !(p.kind === 'area_ambiguous' && isAreaOp(x.op)));
    return commit([...resumed, ...fresh], opts, 'resolve');
  };
  const done = (r: SemanticResult): TurnOutcome => {
    if (hasMsg) state.history.push({ role: 'agent', text: req.message! });
    state.history.push({ role: 'assistant', text: r.message });
    state.history = state.history.slice(-20);
    return { state, result: { ...r, revision: state.revision, criteria: state.criteria } };
  };

  if (req.action) { interpreter = 'structured_action'; return handleAction(req.action); }

  // --- messaggio libero: una sola chiamata LLM, con timeout ---
  if (!deps.llm) return fail('llm_unavailable', 'Interprete non disponibile: nessun criterio modificato. Riprova o usa le opzioni proposte.');
  interpreter = 'llm';
  const message = req.message!.trim();
  const system = buildSystemPrompt({ today: now.date, localTime: minToTime(now.minuteOfDay), criteria: prev.criteria, pending: prev.pendingQuestion, catalog, history: prev.history });
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let text: string;
  try {
    llmCalls++;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(new LlmTimeout()); }, deps.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS); });
    text = await Promise.race([deps.llm.complete({ system, user: message, schema: LLM_OUTPUT_SCHEMA, signal: ctl.signal }), timeout]);
  } catch (e) {
    return e instanceof LlmTimeout ? fail('llm_timeout', 'L\'interprete non ha risposto in tempo: nessun criterio modificato. Puoi ripetere il messaggio?')
      : fail('llm_unavailable', 'Interprete momentaneamente non disponibile: nessun criterio modificato.');
  } finally { clearTimeout(timer); }
  let parsed: unknown;
  try { parsed = parseLlmText(text); } catch { return fail('llm_invalid_output', 'Risposta dell\'interprete non valida: nessun criterio modificato. Puoi riformulare?'); }
  const v = validateLlmOutput(parsed);
  if (!v.ok) return fail('llm_invalid_output', 'Risposta dell\'interprete non conforme allo schema: nessun criterio modificato. Puoi riformulare?');

  // Ogni operazione dell'LLM porta la provenienza del turno: viene sempre validata contro il SUO messaggio originale.
  const llmItems: SourcedOp[] = v.value.operations.map((op) => ({ op, source: { kind: 'llm', turn: ctx.turn, message } }));
  const { clarification } = v.value;
  if (clarification || !llmItems.length) {
    // Si sospendono SOLO operazioni con citazione presente nel messaggio di questo turno: una citazione inventata non diventa attendibile col chiarimento.
    const kept = llmItems.filter((x) => evidenceOk(x.op, message));
    const dropped = llmItems.filter((x) => !evidenceOk(x.op, message)).map((x) => ({ op: x.op.op, reason: `citazione non presente nel messaggio: «${x.op.evidence}»` }));
    state.revision++; state.turn++;
    // La domanda pendente non viene persa: resta sotto (pila); due chiarimenti generici consecutivi si fondono.
    const p = prev.pendingQuestion;
    const merge = p?.kind === 'unclear';
    const q: PendingQuestion = { id: `q${ctx.turn}`, kind: 'unclear', text: clarification?.question || 'Non ho capito la richiesta: indica zona, tipologia di punti e giorno del giro.',
      options: [], deferred: [...(merge ? p!.deferred ?? [] : []), ...kept], opIndex: null, consentKind: null, askedAtTurn: ctx.turn, previous: merge ? p!.previous ?? null : p };
    state.pendingQuestion = q;
    return done(result('needs_clarification', q.text, { question: publicQ(q), rejected: dropped }));
  }
  // decline_consent (semantic-1.0.1): accettata SOLO con citazione presente, domanda di consenso pendente in cima dello stesso tipo e senza grant_consent
  // dello stesso tipo nello stesso output. Altrimenti viene scartata SENZA chiudere la domanda originale (né consenso né rifiuto registrati).
  const pend = prev.pendingQuestion;
  const declineOk = (x: SourcedOp) => evidenceOk(x.op, message) && pend?.kind === 'consent' && !!x.op.consent && pend.consentKind === x.op.consent
    && !llmItems.some((y) => y.op.op === 'grant_consent' && y.op.consent === x.op.consent);
  const conflicted = new Set(llmItems.filter((x) => x.op.op === 'decline_consent').map((x) => x.op.consent));
  const rejectedConsent = llmItems.filter((x) => (x.op.op === 'decline_consent' && !declineOk(x)) || (x.op.op === 'grant_consent' && conflicted.has(x.op.consent)));
  if (rejectedConsent.length) {
    const kept = llmItems.filter((x) => !rejectedConsent.includes(x));
    const dropped = rejectedConsent.map((x) => ({ op: x.op.op, reason: x.op.op === 'grant_consent' ? 'consenso e rifiuto nello stesso messaggio' : !evidenceOk(x.op, message) ? `citazione non presente nel messaggio: «${x.op.evidence}»` : 'rifiuto non riferito alla domanda di consenso pendente (tipo o domanda non corrispondenti)' }));
    const out = kept.length ? route(kept) : commit([], {}, 'side');
    out.result.rejected = [...dropped, ...out.result.rejected];
    return out;
  }
  return route(llmItems);

  function handleAction(a: SemanticAction): TurnOutcome {
    const srv = (op: Operation): SourcedOp => ({ op, source: { kind: 'server', reason: `action:${a.type}` } });
    switch (a.type) {
      case 'answer': {
        const q = prev.pendingQuestion;
        if (!q || q.id !== a.questionId) return fail('unknown_question', 'La domanda a cui rispondi non è più attuale.');
        if (!q.options.some((o) => o.id === a.optionId)) return fail('invalid_request', 'Opzione non prevista dalla domanda.');
        const deferred = q.deferred || [];
        const others = deferred.filter((_, i) => i !== q.opIndex);
        if (q.kind === 'consent') return a.optionId === 'no' ? commit(others) : commit([...others, srv(makeOp({ op: 'grant_consent', consent: q.consentKind }))], { consentSource: 'answer' });
        if (a.optionId === 'skip') return commit(others.filter((x) => !(q.kind === 'area_ambiguous' && isAreaOp(x.op))));
        if (a.optionId.startsWith('drop:')) return commit([srv(makeOp({ op: 'clear', field: a.optionId.slice(5) as ClearField }))]);
        if (a.optionId.startsWith('geo:')) {
          // Scelta esplicita dell'area: sostituisce TUTTE le operazioni territoriali della frase incerta.
          const [mode, x, y] = a.optionId.slice(4).split('|');
          const verb = deferred[q.opIndex ?? -1]?.op.op === 'add_locality' ? 'add_locality' : 'replace_area';
          const geo = mode === 'provincia' ? [makeOp({ op: verb, provincia: x })]
            : [makeOp({ op: verb, locality: x, provincia: y || null }), ...(mode === 'nearby' ? [makeOp({ op: 'set', field: 'allow_nearby', flag: true })] : [])];
          return commit([...deferred.filter((d) => !isAreaOp(d.op)), ...geo.map(srv)]);
        }
        if (q.opIndex === null || q.opIndex < 0 || !deferred[q.opIndex]) return fail('invalid_request', 'Domanda senza operazione da completare.');
        // L'operazione ambigua aveva già superato la verifica della citazione; il valore scelto ora viene dal catalogo del server.
        const target = deferred[q.opIndex].op;
        let chosen: Operation;
        if (a.optionId.startsWith('loc:')) { const [name, prov] = a.optionId.slice(4).split('|'); chosen = { ...target, locality: name, provincia: prov || null }; }
        else if (a.optionId.startsWith('ref:')) chosen = { ...target, refId: a.optionId.slice(4), mention: null };
        else return fail('invalid_request', 'Opzione non applicabile.');
        return commit(deferred.map((d, i) => (i === q.opIndex ? srv(chosen) : d)));
      }
      case 'dismiss_question': {
        const q = prev.pendingQuestion;
        if (!q || q.id !== a.questionId) return fail('unknown_question', 'La domanda da annullare non è più attuale.');
        return commit((q.deferred ?? []).filter((x, i) => i !== q.opIndex && !(q.kind === 'area_ambiguous' && isAreaOp(x.op))));
      }
      case 'follow_up_decision': return route([srv(makeOp({ op: 'follow_up', refId: a.eventId, decision: a.decision }))]);
      case 'propose_reschedule': return route([srv(makeOp({ op: 'propose_reschedule', refId: a.eventId, proposedDate: a.proposedDate }))]);
      case 'require_stop': case 'exclude_stop': return route([srv(makeOp({ op: a.type, refId: a.key }))]);
      case 'grant_consent': return route([srv(makeOp({ op: 'grant_consent', consent: a.kind, dates: a.dates ?? null }))], { consentSource: 'action' });
      case 'set_date': return route([srv(makeOp({ op: 'set', field: 'dates', dates: [a.date] }))]);
      case 'reset': return commit([srv(makeOp({ op: 'reset_all' }))]);
      default: return fail('invalid_request', 'Azione non riconosciuta.');
    }
  }
}

/** Proposta di espansione del SISTEMA (es. il planner rileva che servono più giornate): domanda di consenso esplicito, criteri invariati. */
export function proposeExpansion(prev: SemanticState, proposal: ExpansionProposal, text: string): SemanticState {
  const turn = prev.turn + 1;
  const q: PendingQuestion = { id: `q${turn}`, kind: 'consent', text, options: [{ id: 'yes', label: 'Sì, accetto la proposta' }, { id: 'no', label: 'No' }],
    deferred: null, opIndex: null, consentKind: proposal.kind, askedAtTurn: turn, proposal, previous: prev.pendingQuestion };
  return { ...clone(prev), revision: prev.revision + 1, turn, pendingQuestion: q, history: [...prev.history, { role: 'assistant' as const, text }].slice(-20) };
}

function pendingFrom(issue: Issue, items: SourcedOp[], turn: number): PendingQuestion {
  return { id: `q${turn}`, kind: issue.kind, text: issue.text, options: issue.options, deferred: items, opIndex: issue.opIndex >= 0 ? issue.opIndex : null,
    consentKind: issue.consentKind ?? null, askedAtTurn: turn };
}
function problemSlot(p: PendingQuestion): string | null {
  if (p.kind === 'consent' && p.consentKind) return `consent:${p.consentKind}`;
  if (p.kind === 'area_ambiguous') return 'area';
  return p.opIndex !== null && p.deferred?.[p.opIndex] ? slotOf(p.deferred[p.opIndex].op) : null;
}
/** Toglie dalle operazioni sospese quelle superate dal nuovo input (stesso ambito), mai l'operazione su cui verte la domanda. */
function prune(q: PendingQuestion, slots: Set<string>): PendingQuestion {
  if (!q.deferred) return q;
  const keep = q.deferred.map((d, i) => i === q.opIndex || !slots.has(slotOf(d.op)));
  return { ...q, deferred: q.deferred.filter((_, i) => keep[i]), opIndex: q.opIndex === null ? null : keep.slice(0, q.opIndex).filter(Boolean).length };
}
/** Applica la precedenza del nuovo input a tutta la pila. `carry` = operazioni di domande superate senza una domanda superstite sopra:
 *  vanno applicate ora (prima delle nuove, che quindi prevalgono). */
function supersede(q: PendingQuestion | null | undefined, slots: Set<string>): { stack: PendingQuestion | null; carry: SourcedOp[] } {
  if (!q) return { stack: null, carry: [] };
  const below = supersede(q.previous, slots);
  const pq = prune(q, slots);
  const ps = problemSlot(pq);
  if (ps && slots.has(ps)) {
    const rest = (pq.deferred ?? []).filter((x, i) => i !== pq.opIndex && !(pq.kind === 'area_ambiguous' && isAreaOp(x.op)));
    return { stack: below.stack, carry: [...below.carry, ...rest] };
  }
  const deferred = below.carry.length ? [...below.carry, ...(pq.deferred ?? [])] : pq.deferred;
  return { stack: { ...pq, deferred, opIndex: pq.opIndex === null ? null : pq.opIndex + below.carry.length, previous: below.stack }, carry: [] };
}
const WD = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const consentNotice = (x: { kind: ConsentKind; dates: string[] }) =>
  `Autorizzazione al giorno non lavorativo per ${x.dates.map((d) => `${WD[isoDow(d) - 1]} ${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ')} non più valida: le date del giro sono cambiate.`;
const publicQ = (q: PendingQuestion) => ({ id: q.id, kind: q.kind, text: q.text, options: q.options });
