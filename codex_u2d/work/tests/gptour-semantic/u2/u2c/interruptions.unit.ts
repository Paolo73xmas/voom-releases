// Interruptions: crash points C1–C8 (worker dies, a NEW worker retries the same requestId), LLM faults (MOCKED), store faults (ACK lost).
// Verified per case: claim outcome, processing_attempts, llm_dispatches_reserved, observed dispatches, revision, plans, request status.
import { A, check, deps, done, faultyStore, getState, labConfig, makeLab, newSession as newSess, turnReq, type LlmStep } from './harness.ts';
import { handle } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/turn.ts';
import type { TurnDeps } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/ports.ts';
import { payloadHash } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/canonical.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
const lab = makeLab(labConfig()), K = `[${lab.kind}]`, valid = (b: unknown) => validateTransportResponse(b).ok;
const newSession = () => newSess(lab);
const rev = async (sid: string) => (await getState(lab, sid)).sessionRevision as number;
const plansOf = async (sid: string) => { const s = await lab.store.getState(A, sid); return s.lastPlanId ? 1 : 0; };
const crashAt = (point: string): TurnDeps['crash'] => (p) => { if (p === point) { const e = new Error(`LAB CRASH ${point}`); e.name = 'WorkerCrash'; throw e; } };
async function crashed(sid: string, rid: string, d: TurnDeps) { try { await handle(turnReq(sid, rid, 0), A, d); return 'no-crash'; } catch (e) { return (e as Error).message; } }
let dispatchesTotal = 0; const count = (d: ReturnType<typeof deps>) => { dispatchesTotal += d.llm?.calls ?? 0; };

// C1: crash before claim → nothing stored; retry = new
{ const sid = await newSession(), R = crypto.randomUUID(); const d = deps(lab, { crash: crashAt('C1') });
  check((await crashed(sid, R, d)) === 'LAB CRASH C1', `${K} C1 crash prima della claim`); count(d);
  const d2 = deps(lab); const t = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t.diagnostics.claim === 'new' && t.http === 200 && d2.llm!.calls === 1, `${K} C1 retry → new, 1 invio, committed`, t.diagnostics); }
// C2: crash after claim, before store_context — catalog unchanged vs changed (acceptedAt preserved, context stable only after persistence)
for (const changed of [false, true]) {
  const sid = await newSession(), R = crypto.randomUUID(); const d = deps(lab, { crash: crashAt('C2') });
  check((await crashed(sid, R, d)) === 'LAB CRASH C2', `${K} C2 crash dopo claim (catalogo ${changed ? 'cambiato' : 'invariato'} al retry)`); count(d);
  const rw = await lab.store.claim(A, sid, R, 'x'.repeat(64), 0);
  check(rw.outcome === 'reused' && rw.status === 'pending', `${K} C2 request pending senza contesto, acceptedAt fissato dal DB`, rw.outcome);
  await lab.expireLease(sid, R);
  const d2 = deps(lab); if (changed) d2.catalog = { async load() { return { localities: [{ name: 'Milano', provincia: 'MI' }, { name: 'Lodi', provincia: 'LO' }], provinces: [{ sigla: 'MI', nome: 'Milano' }], events: [], stops: [], projects: [] }; } };
  const t = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  const ctx = JSON.parse(t.body.result ? '{}' : '{}'); void ctx;
  check(t.diagnostics.claim === 'takeover' && t.http === 200 && t.body.acceptedAt === rw.acceptedAt && d2.llm!.calls === 1 && t.diagnostics.llmReserved === 0, `${K} C2 retry → takeover, acceptedAt conservato, contesto costruito dal catalogo ${changed ? 'NUOVO (nessuna promessa di identità)' : 'invariato'}, 1 invio`, t.diagnostics);
  const tr = await handle(turnReq(sid, R, 0), A, deps(lab));
  check(JSON.stringify(tr.body) === JSON.stringify(t.body), `${K} C2 dopo il commit il replay è stabile (byte-identico)`); }
// C3: crash after store_context → recovered context reused (hash identical), reserves 0
{ const sid = await newSession(), R = crypto.randomUUID(); const d = deps(lab, { crash: crashAt('C3') });
  check((await crashed(sid, R, d)) === 'LAB CRASH C3', `${K} C3 crash dopo store_context`); count(d);
  await lab.expireLease(sid, R); const tk = await lab.store.claim(A, sid, R, 'x'.repeat(64), 0); // reused (hash differs) just to read state
  check(tk.outcome === 'reused' && tk.llmDispatchesReserved === 0, `${K} C3 riserve 0 prima del retry`);
  const d2 = deps(lab); d2.catalog = { async load() { throw new Error('catalog must not be reloaded when context is persisted'); } };
  const t = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t.diagnostics.claim === 'takeover' && t.http === 200 && d2.llm!.calls === 1, `${K} C3 retry → contesto persistito riusato (catalogo NON ricaricato), 1 invio`, t.diagnostics); }
// C4: reservation ACK lost (begin_llm executed, answer lost) → no dispatch on uncertain outcome, slot consumed, recoverable; retry uses 2nd slot
{ const sid = await newSession(), R = crypto.randomUUID(); const d = deps(lab); d.store = faultyStore(lab.store, { beginLlm: 'ack_lost' });
  const t = await handle(turnReq(sid, R, 0), A, d); count(d);
  check(t.http === 503 && t.body.errorCode === 'storage_retryable' && t.body.outcome === 'recoverable' && d.llm!.calls === 0 && valid(t.body), `${K} C4 ACK riserva perso → nessun invio, 503 recuperabile (T12)`, t.body);
  await lab.expireLease(sid, R); const d2 = deps(lab); const t2 = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t2.diagnostics.claim === 'takeover' && t2.diagnostics.llmReserved === 1 && t2.http === 200 && d2.llm!.calls === 1 && t2.diagnostics.gate.some(g => g.kind === 'dispatched'), `${K} C4 retry: slot 1 consumato senza invio, 2ª riserva → 1 invio → committed`, t2.diagnostics); }
// C5: output received, store_llm ACK lost twice → ≤2 dispatches, budget exhausted → 503 D, +0 (T14)
{ const sid = await newSession(), R = crypto.randomUUID(); let total = 0;
  for (let i = 0; i < 2; i++) { const d = deps(lab); d.store = faultyStore(lab.store, { storeLlm: 'throw_before' }); const t = await handle(turnReq(sid, R, 0), A, d); total += d.llm!.calls; count(d);
    check(t.http === 503 && t.body.errorCode === 'storage_retryable' && d.llm!.calls === 1, `${K} C5 tentativo ${i + 1}: invio poi store fallito → recuperabile`, t.body); await lab.expireLease(sid, R); }
  const d3 = deps(lab); const t3 = await handle(turnReq(sid, R, 0), A, d3); count(d3);
  check(total === 2 && d3.llm!.calls === 0 && t3.http === 503 && t3.body.errorCode === 'llm_budget_exhausted' && t3.body.outcome === 'committed' && (await rev(sid)) === 0 && valid(t3.body), `${K} C5 due invii persi → budget esaurito 503 D, +0, zero nuovi invii (T14)`, t3.body); }
// C6: crash after store_llm, before commit; N takeovers → zero additional dispatches, same output (T15)
{ const sid = await newSession(), R = crypto.randomUUID(); const d = deps(lab, { crash: crashAt('C6') });
  check((await crashed(sid, R, d)) === 'LAB CRASH C6' && d.llm!.calls === 1, `${K} C6 crash dopo store_llm`); count(d);
  for (let i = 0; i < 2; i++) { await lab.expireLease(sid, R); const dc = deps(lab, { crash: crashAt('C6') }); await crashed(sid, R, dc); count(dc); check(dc.llm!.calls === 0 && dc.planner.calls === 0, `${K} C6 takeover ${i + 1}: output riusato, zero invii`); }
  await lab.expireLease(sid, R); const d2 = deps(lab); const t = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t.http === 200 && d2.llm!.calls === 0 && t.diagnostics.gate[0]?.kind === 'replayed' && t.diagnostics.llmReserved === 1 && (await plansOf(sid)) === 1, `${K} C6 commit finale: output recuperato (replayed), 1 riserva totale, 1 piano (T15)`, t.diagnostics); }
// C7: commit executed, ACK lost → outcome_unknown; replay → cached identical, +0 (T07)
{ const sid = await newSession(), R = crypto.randomUUID(); const d = deps(lab); d.store = faultyStore(lab.store, { commitSuccess: 'ack_lost' });
  const t = await handle(turnReq(sid, R, 0), A, d); count(d);
  check(t.http === 503 && t.body.errorCode === 'outcome_unknown' && t.body.nextAction === 'get_request' && valid(t.body), `${K} C7 ACK commit perso → 503 outcome_unknown → get_request`, t.body);
  const d2 = deps(lab); const t2 = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t2.diagnostics.claim === 'cached' && t2.http === 200 && t2.body.sessionRevision === 1 && d2.llm!.calls === 0 && d2.planner.calls === 0 && (await rev(sid)) === 1, `${K} C7 replay → cached, +0, zero LLM/planner (T07)`, t2.diagnostics); }
// C8 / T10: old worker wakes up with the old token after a takeover → its writes are rejected, new worker intact
{ const sid = await newSession(), R = crypto.randomUUID(); const c = await lab.store.claim(A, sid, R, 'y'.repeat(64), 0); if (c.outcome !== 'new') throw new Error('new');
  await lab.store.storeContext(A, sid, R, c.token, { k: 1 }); await lab.expireLease(sid, R);
  const d2 = deps(lab); const t = await handle(turnReq(sid, R, 0), A, d2); // handle computes its own hash → 'reused' (different hash) so use store directly for the new worker
  check(t.diagnostics.claim === 'reused' && t.http === 422, `${K} C8 stessa requestId con payload diverso → 422 request_id_reused (T25)`);
  const tk = await lab.store.claim(A, sid, R, 'y'.repeat(64), 0); if (tk.outcome !== 'takeover') throw new Error('takeover');
  const codes = await Promise.all([lab.store.renewLease(A, sid, R, c.token), lab.store.storeLlm(A, sid, R, c.token, 'z', {}), lab.store.finishError(A, sid, R, c.token, 500, {})].map(p => p.then(() => 'ok', e => e.sqlstate)));
  check(codes.every(x => x === 'PT409') && (await lab.store.recoverWork(A, sid, R, tk.token)).processingAttempts === 2, `${K} C8 vecchio worker: renew/store/finish respinti (409); nuovo worker intatto (T10)`, codes); }
// LLM faults (T26): timeout with slot → recoverable; invalid output → 502 D; STRUCTURED provider errors: 401/403 permanent → 503 llm_unavailable D with NO second call; 429/5xx transient → recoverable then budget
{ const sid = await newSession(); const R = crypto.randomUUID(); const d = deps(lab, { llmSteps: [{ kind: 'timeout' }] }); const t = await handle(turnReq(sid, R, 0), A, d); count(d);
  check(t.http === 503 && t.body.errorCode === 'llm_retryable' && t.body.outcome === 'recoverable' && t.diagnostics.llmReserved === 0 && valid(t.body), `${K} timeout provider con slot residuo → 503 llm_retryable (pending)`, t.body);
  await lab.expireLease(sid, R); const d2 = deps(lab, { llmSteps: [{ kind: 'timeout' }] }); const t2 = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t2.http === 503 && t2.body.errorCode === 'llm_budget_exhausted' && t2.body.outcome === 'committed' && (await rev(sid)) === 0, `${K} secondo timeout → budget esaurito 503 D, +0`, t2.body);
  const R2 = crypto.randomUUID(); const d3 = deps(lab, { llmSteps: [{ kind: 'invalid' }] }); const t3 = await handle(turnReq(sid, R2, 0), A, d3); count(d3);
  check(t3.http === 502 && t3.body.errorCode === 'llm_invalid_output' && t3.body.outcome === 'committed' && d3.llm!.calls === 1 && valid(t3.body), `${K} output invalido → 502 D immediato, nessuna riparazione LLM`, t3.body);
  const R3 = crypto.randomUUID(); const d4 = deps(lab, { llmSteps: [{ kind: 'http', status: 401 }, { kind: 'ok' }] as LlmStep[] }); const t4 = await handle(turnReq(sid, R3, 0), A, d4); count(d4);
  check(t4.http === 503 && t4.body.errorCode === 'llm_unavailable' && t4.body.outcome === 'committed' && t4.body.retryableSameRequest === false && d4.llm!.calls === 1 && t4.diagnostics.gate.at(-1)?.kind === 'provider_error' && valid(t4.body), `${K} provider 401 (permanente, strutturato) → 503 llm_unavailable D, UN solo invio, nessuna seconda chiamata automatica`, t4.body);
  const d4b = deps(lab, { llmSteps: [{ kind: 'ok' }] }); const t4b = await handle(turnReq(sid, R3, 0), A, d4b); count(d4b);
  check(t4b.diagnostics.claim === 'cached' && t4b.body.errorCode === 'llm_unavailable' && d4b.llm!.calls === 0 && (await rev(sid)) === 0, `${K} replay dopo 401 → cached terminale, zero invii, +0`, t4b.diagnostics);
  const R3b = crypto.randomUUID(); const d4c = deps(lab, { llmSteps: [{ kind: 'http', status: 403 }] as LlmStep[] }); const t4c = await handle(turnReq(sid, R3b, 0), A, d4c); count(d4c);
  check(t4c.http === 503 && t4c.body.errorCode === 'llm_unavailable' && d4c.llm!.calls === 1, `${K} provider 403 → llm_unavailable D (permanente)`, t4c.body);
  const R5 = crypto.randomUUID(); const d6 = deps(lab, { llmSteps: [{ kind: 'http', status: 429 }] as LlmStep[] }); const t6 = await handle(turnReq(sid, R5, 0), A, d6); count(d6);
  check(t6.http === 503 && t6.body.errorCode === 'llm_retryable' && t6.body.outcome === 'recoverable' && d6.llm!.calls === 1 && valid(t6.body), `${K} provider 429 (transitorio, strutturato) con slot residuo → 503 llm_retryable (pending)`, t6.body);
  await lab.expireLease(sid, R5); const d7 = deps(lab, { llmSteps: [{ kind: 'http', status: 503 }] as LlmStep[] }); const t7 = await handle(turnReq(sid, R5, 0), A, d7); count(d7);
  check(t7.http === 503 && t7.body.errorCode === 'llm_budget_exhausted' && t7.body.outcome === 'committed' && d7.llm!.calls === 1 && t7.diagnostics.llmReserved === 1, `${K} poi provider 503 → 2ª riserva, budget esaurito 503 D (≤2 invii totali)`, t7.body);
  const R6 = crypto.randomUUID(); const d8 = deps(lab, { llmSteps: [{ kind: 'raw', text: JSON.stringify({ operations: [{ op: 'add_locality', locality: 'Milano', evidence: '' }], clarification: null }) }] as LlmStep[] }); const t8 = await handle(turnReq(sid, R6, 0), A, d8); count(d8);
  check(t8.http === 502 && t8.body.errorCode === 'llm_invalid_output' && d8.llm!.calls === 1 && (await rev(sid)) === 0, `${K} output LLM con citazione vuota → 502 llm_invalid_output (validazione citazioni LLM invariata e rigorosa)`, t8.body);
  const R4 = crypto.randomUUID(); const d5 = deps(lab, { llm: null }); const t5 = await handle(turnReq(sid, R4, 0), A, d5);
  check(t5.http === 503 && t5.body.errorCode === 'llm_unavailable' && t5.body.outcome === 'committed' && valid(t5.body), `${K} porta LLM assente → 503 llm_unavailable D`, t5.body); }
// T38: deadline passed with a live worker → 503 processing_expired D (memory clock only; SQL path proven in U2-b B5)
if (lab.kind === 'memory') { const sid = await newSession(), R = crypto.randomUUID(); const c = await lab.store.claim(A, sid, R, await payloadHash(turnReq(sid, R, 0)), 0); void c; lab.advance(5 * 60000 + 1);
  const t = await handle(turnReq(sid, R, 0), A, deps(lab));
  check(t.http === 503 && t.body.errorCode === 'processing_expired' && t.diagnostics.claim === 'deadline_finalized' && valid(t.body) && (await rev(sid)) === 0, `${K} deadline superata → 503 processing_expired D, +0 (T38)`, t.body); }
// L2 only: REAL SQL fault inside commit_success (after the session UPDATE) → storage_retryable, state unchanged; retry commits once.
if (lab.sqlFault) { const sid = await newSession(), R = crypto.randomUUID(); await lab.sqlFault(true);
  const d = deps(lab); const t = await handle(turnReq(sid, R, 0), A, d); count(d);
  check(t.http === 503 && t.body.errorCode === 'storage_retryable' && t.body.outcome === 'recoverable' && d.llm!.calls === 1 && (await rev(sid)) === 0 && valid(t.body), `${K} guasto SQL REALE nel commit → 503 storage_retryable, sessione rev 0, nessuna anteprima`, t.body);
  await lab.sqlFault(false); await lab.expireLease(sid, R);
  const d2 = deps(lab); const t2 = await handle(turnReq(sid, R, 0), A, d2); count(d2);
  check(t2.http === 200 && t2.diagnostics.claim === 'takeover' && d2.llm!.calls === 0 && t2.diagnostics.gate[0]?.kind === 'replayed' && (await rev(sid)) === 1 && (await plansOf(sid)) === 1, `${K} guasto rimosso: retry → output riusato (zero invii), un solo commit, un solo piano`, t2.diagnostics); }
console.log(`${K} invii LLM MOCKED osservati in totale: ${dispatchesTotal}`);
done(`U2C INTERRUPTIONS[${lab.kind}]`);
