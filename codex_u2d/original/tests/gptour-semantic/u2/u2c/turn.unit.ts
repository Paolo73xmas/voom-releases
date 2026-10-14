import { TRANSPORT_VERSION } from '../../../../supabase/functions/_shared/gptour-semantic-transport/contract.ts';
// Turn orchestration: public projections (semantic-1.1), state machine, §4 mapping, gate questions, parity (T33), concurrency (T04/T34), replay (T07/T39).
import { A, B, check, deps, done, faultyStore, getState, labConfig, makeLab, newSession, plannerMock, turnReq } from './harness.ts';
import { handle } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/turn.ts';
import { payloadHash } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/canonical.ts';
import { makeOp } from '../../../../supabase/functions/_shared/gptour-semantic/interpreter.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
const lab = makeLab(labConfig()), K = `[${lab.kind}]`;
const valid = (b: unknown) => validateTransportResponse(b).ok;
const SNAPSHOT_KEYS = ['context', 'contractVersion', 'criteria', 'engineVersion', 'expiresAt', 'gate', 'notices', 'openQuestionCount', 'openQuestions', 'question', 'sessionId', 'sessionRevision'];
const keysOf = (o: unknown) => JSON.stringify(Object.keys(o as Record<string, unknown>).sort());
const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
// invalid request: nothing stored, contractual error body
const bad = await handle({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: crypto.randomUUID() }, A, deps(lab));
check(bad.http === 400 && bad.body.errorCode === 'invalid_request' && bad.body.outcome === 'not_accepted' && bad.diagnostics.claim === null && valid(bad.body), `${K} richiesta invalida → 400 not_accepted senza claim, body valido`, bad.body);
const cap = await handle({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION }, A, deps(lab));
check(cap.http === 200 && valid(cap.body) && (cap.body.operations as string[]).length === 6, `${K} capabilities → 200 valido`, cap.body);
// create_session: 201 + public snapshot only
const cs = await handle({ operation: 'create_session', contractVersion: TRANSPORT_VERSION }, A, deps(lab));
const st0 = cs.body.state as Record<string, unknown>;
check(cs.http === 201 && cs.body.operation === 'create_session' && valid(cs.body) && keysOf(st0) === JSON.stringify(SNAPSHOT_KEYS), `${K} create_session → 201 con StateSnapshot semantic-1.1 (nessun campo interno SQL)`, cs.body);
check(st0.sessionRevision === 0 && st0.gate === null && st0.question === null && (st0.openQuestions as unknown[]).length === 0 && (st0.criteria as Record<string, unknown>).coverage === 'selection' && (st0.context as Record<string, unknown>).lastPlanId === null, `${K} snapshot iniziale: rev 0, criteri vuoti, gate null, contesto vuoto`, st0);
const csB = await handle({ operation: 'create_session', contractVersion: TRANSPORT_VERSION }, B, deps(lab));
check(csB.http === 403 && csB.body.errorCode === 'forbidden_agent' && valid(csB.body), `${K} create_session caller non abilitato → 403 forbidden_agent valido`, csB.body);
const sid = st0.sessionId as string;
// happy path: message → one LLM dispatch → planner → committed planned
const R1 = crypto.randomUUID(); const d1 = deps(lab);
const t1 = await handle(turnReq(sid, R1, 0), A, d1);
check(t1.http === 200 && t1.body.outcome === 'committed' && t1.body.gate === 'planned' && t1.body.sessionRevision === 1 && !!t1.body.plan && valid(t1.body), `${K} turno con messaggio → 200 committed planned, body valido`, t1.body);
check(d1.llm!.calls === 1 && t1.diagnostics.llmDispatched === 1 && d1.planner.calls === 1 && (t1.body.result as Record<string, unknown>).revision === 1, `${K} un solo invio LLM, un planner, result.revision stampata`, t1.diagnostics);
const plan1 = t1.body.plan as Record<string, unknown>;
check(plan1.sessionId === sid && plan1.sessionRevision === 1 && typeof plan1.planId === 'string' && plan1.verification === 'estimated_routing', `${K} plan: identità/revisione stampate dal SQL, routing stimato (mock)`, plan1);
// T07/T39: replay identical, zero new LLM/planner
const d1b = deps(lab); const t1b = await handle(turnReq(sid, R1, 0), A, d1b);
check(t1b.http === 200 && JSON.stringify(t1b.body) === JSON.stringify(t1.body) && t1b.diagnostics.claim === 'cached' && d1b.llm!.calls === 0 && d1b.planner.calls === 0, `${K} replay → cached byte-identico, zero LLM/planner (T07/T39)`);
// T33 parity
check(await payloadHash(turnReq(sid, R1, 0, 'Vai a Milano', 'web')) === await payloadHash(turnReq(sid, R1, 0, 'Vai a Milano', 'mobile')), `${K} hash identico web/mobile (T33)`);
const t1m = await handle(turnReq(sid, R1, 0, 'Vai a Milano', 'mobile'), A, deps(lab));
check(JSON.stringify(t1m.body) === JSON.stringify(t1.body), `${K} stessa request done via mobile → body identico`);
// get_state / get_plan / get_request projections
const gsr = await handle({ operation: 'get_state', contractVersion: TRANSPORT_VERSION, sessionId: sid }, A, deps(lab)); const gs = gsr.body.state as Record<string, unknown>;
check(gsr.http === 200 && valid(gsr.body) && keysOf(gs) === JSON.stringify(SNAPSHOT_KEYS) && gs.sessionRevision === 1 && gs.gate === 'planned' && (gs.context as Record<string, unknown>).lastPlanId === plan1.planId && (gs.context as Record<string, unknown>).planRevision === 1, `${K} get_state → StateSnapshot valido: rev 1, gate planned, context.lastPlanId`, gsr.body);
check(JSON.stringify(((gs.criteria as Record<string, unknown>).area as Record<string, unknown>).localities) === JSON.stringify([{ name: 'Milano', provincia: 'MI' }]), `${K} get_state: criteri pubblici dal catalogo (Milano MI)`, gs.criteria);
const gp = await handle({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, sessionId: sid, planId: plan1.planId }, A, deps(lab));
check(gp.http === 200 && gp.body.isCurrentRevision === true && valid(gp.body), `${K} get_plan valido, isCurrentRevision`, gp.body);
const gr = await handle({ operation: 'get_request', contractVersion: TRANSPORT_VERSION, sessionId: sid, requestId: R1 }, A, deps(lab));
const grr = gr.body.receipt as Record<string, unknown>;
check(valid(gr.body) && grr.status === 'done' && grr.originalHttpStatus === 200 && JSON.stringify(grr.response) === JSON.stringify(t1.body), `${K} get_request: ricevuta contrattuale con risposta terminale`, gr.body);
const gnf = await handle({ operation: 'get_request', contractVersion: TRANSPORT_VERSION, sessionId: sid, requestId: crypto.randomUUID() }, A, deps(lab));
check(valid(gnf.body) && (gnf.body.receipt as Record<string, unknown>).status === 'not_found', `${K} get_request sconosciuta → not_found`);
// T03: stale expectedRevision before LLM → 409 D, +0, zero LLM
const d3 = deps(lab); const t3 = await handle(turnReq(sid, crypto.randomUUID(), 0), A, d3);
check(t3.http === 409 && t3.body.errorCode === 'revision_conflict' && t3.body.outcome === 'committed' && d3.llm!.calls === 0 && valid(t3.body), `${K} expectedRevision vecchia → 409 revision_conflict senza LLM (T03)`, t3.body);
// action without LLM → zero reservations (T27); server operation represented with evidence '' and VALID (D-U2C-01 corrected)
const d4 = deps(lab); const t4 = await handle(turnReq(sid, crypto.randomUUID(), 1, { action: { type: 'set_date', date: '2026-12-21' } }), A, d4);
const applied4 = ((t4.body.result as Record<string, unknown>).applied as Array<Record<string, unknown>>);
check(t4.http === 200 && d4.llm!.calls === 0 && t4.diagnostics.llmReserved === 0 && t4.body.sessionRevision === 2 && t4.body.gate === 'planned', `${K} action → zero LLM, rev 2, committed (T27)`, t4.diagnostics);
check(valid(t4.body) && applied4.length === 1 && applied4[0].op === 'set' && applied4[0].evidence === '', `${K} D-U2C-01 CORRETTA: operazione server in result.applied (evidence '' = provenienza server) passa il validatore semantic-1.1`, validateTransportResponse(t4.body));
// pending question → zero planner, question persisted in snapshot
const d5 = deps(lab, { llmSteps: [{ kind: 'ok', locality: 'Sconosciuta' }] }); const t5 = await handle(turnReq(sid, crypto.randomUUID(), 2, 'Vai a Sconosciuta'), A, d5);
check(t5.http === 200 && t5.body.gate === 'pending_question' && (t5.body.openQuestions as unknown[]).length === 1 && d5.planner.calls === 0 && t5.body.plan === null && valid(t5.body), `${K} domanda aperta → pending_question, zero planner (T27)`, t5.body);
const gs5 = await getState(lab, sid);
check(gs5.gate === 'pending_question' && gs5.openQuestionCount === 1 && (gs5.question as Record<string, unknown>).id === (t5.body.openQuestions as Array<Record<string, unknown>>)[0].id && gs5.sessionRevision === 3, `${K} get_state dopo domanda: gate pending_question, domanda in cima, rev 3`, gs5);
// BLOCKED by an unsupported criterion ("Fatturato almeno 5000"): the gate question is persisted and returned with answerable options; one revision per turn
const sidB = await newSession(lab); const RB = crypto.randomUUID();
const dB = deps(lab, { llmSteps: [{ kind: 'ok', ops: [makeOp({ op: 'set', field: 'revenue_min', number: 5000, evidence: 'almeno 5000' })] }] });
const tB = await handle(turnReq(sidB, RB, 0, 'Fatturato almeno 5000'), A, dB);
const qB = (tB.body.openQuestions as Array<Record<string, unknown>>)[0] ?? null;
check(tB.http === 200 && tB.body.outcome === 'committed' && tB.body.gate === 'blocked' && tB.body.plan === null && dB.planner.calls === 0 && valid(tB.body), `${K} criterio non supportato → 200 committed blocked, zero planner, body valido`, tB.body);
check(!!qB && qB.kind === 'unsupported_criteria' && (qB.options as Array<Record<string, unknown>>).some(o => o.id === 'drop:revenue') && tB.body.openQuestionCount === 1 && (tB.body.result as Record<string, unknown>).question !== null, `${K} blocked: domanda del cancello restituita con opzione rispondibile drop:revenue`, tB.body.openQuestions);
check((tB.body.notApplied as Array<Record<string, unknown>>).some(n => n.reason === 'revenue') && tB.body.sessionRevision === 1 && (tB.body.result as Record<string, unknown>).revision === 1, `${K} blocked: notApplied revenue, UNA sola revisione (1)`, tB.body.notApplied);
const gsB = await getState(lab, sidB);
check(gsB.sessionRevision === 1 && gsB.gate === 'blocked' && gsB.openQuestionCount === 1 && (gsB.question as Record<string, unknown>).id === qB?.id && ((gsB.criteria as Record<string, unknown>).revenue as Record<string, unknown>)?.min === 5000, `${K} get_state dopo blocked: domanda persistita, criterio presente, rev 1`, gsB);
const dB2 = deps(lab); const tB2 = await handle(turnReq(sidB, crypto.randomUUID(), 1, { action: { type: 'answer', questionId: qB!.id as string, optionId: 'drop:revenue' } }), A, dB2);
const appliedB2 = ((tB2.body.result as Record<string, unknown>).applied as Array<Record<string, unknown>>);
check(tB2.http === 200 && tB2.body.gate === 'planned' && tB2.body.sessionRevision === 2 && dB2.planner.calls === 1 && dB2.llm!.calls === 0 && tB2.body.openQuestionCount === 0 && valid(tB2.body), `${K} risposta drop:revenue → criterio rimosso, planned, rev 2, zero LLM, body valido`, tB2.body);
check(appliedB2.length === 1 && appliedB2[0].op === 'clear' && appliedB2[0].field === 'revenue' && appliedB2[0].evidence === '' && ((tB2.body.result as Record<string, unknown>).criteria as Record<string, unknown>).revenue === null, `${K} operazione server clear:revenue con evidence '' (nessuna citazione inventata)`, appliedB2);
const gsB2 = await getState(lab, sidB);
check(gsB2.sessionRevision === 2 && gsB2.gate === 'planned' && gsB2.openQuestionCount === 0 && (gsB2.context as Record<string, unknown>).planRevision === 2, `${K} get_state dopo risposta: rev 2, gate planned, nessuna domanda`, gsB2);
// NEEDS_CONSENT: Sunday tour with working days Mon–Fri → consent question (yes/no) persisted; "yes" → planned; one revision per turn
const sidC = await newSession(lab); const WD = [1, 2, 3, 4, 5];
const dC = deps(lab, { workingDays: WD, llmSteps: [{ kind: 'ok', ops: [makeOp({ op: 'add_locality', locality: 'Milano', provincia: null, evidence: 'Milano' }), makeOp({ op: 'set', field: 'dates', dates: ['2026-12-27'], evidence: 'domenica 27 dicembre' })] }] });
const tC = await handle(turnReq(sidC, crypto.randomUUID(), 0, 'Giro domenica 27 dicembre a Milano'), A, dC);
const qC = (tC.body.openQuestions as Array<Record<string, unknown>>)[0] ?? null;
check(tC.http === 200 && tC.body.gate === 'needs_consent' && tC.body.plan === null && dC.planner.calls === 0 && tC.body.sessionRevision === 1 && valid(tC.body), `${K} giorno non lavorativo → 200 committed needs_consent, zero planner, rev 1, body valido`, tC.body);
check(!!qC && qC.kind === 'consent' && JSON.stringify((qC.options as Array<Record<string, unknown>>).map(o => o.id)) === JSON.stringify(['yes', 'no']) && tC.body.openQuestionCount === 1, `${K} needs_consent: domanda di consenso con opzioni yes/no`, qC);
const gsC = await getState(lab, sidC);
check(gsC.gate === 'needs_consent' && gsC.sessionRevision === 1 && (gsC.question as Record<string, unknown>).id === qC?.id, `${K} get_state: consenso pendente persistito, rev 1`, gsC);
const dC2 = deps(lab, { workingDays: WD }); const tC2 = await handle(turnReq(sidC, crypto.randomUUID(), 1, { action: { type: 'answer', questionId: qC!.id as string, optionId: 'yes' } }), A, dC2);
const consents = ((tC2.body.result as Record<string, unknown>).criteria as Record<string, unknown>).consents as Array<Record<string, unknown>>;
check(tC2.http === 200 && tC2.body.gate === 'planned' && tC2.body.sessionRevision === 2 && dC2.planner.calls === 1 && dC2.llm!.calls === 0 && tC2.body.openQuestionCount === 0 && valid(tC2.body), `${K} consenso "yes" → planned, rev 2 (una revisione per turno), zero LLM`, tC2.body);
check(consents.length === 1 && consents[0].kind === 'non_working_day' && JSON.stringify(consents[0].dates) === JSON.stringify(['2026-12-27']) && consents[0].source === 'answer', `${K} consenso non_working_day legato alla data esatta, provenienza answer`, consents);
// REFUSED CONSENT: "no" is conserved per scope → no consent, no plan on the refused date, the same authorization is never re-asked; clarification (change/clear date) persisted; one revision per turn
const sidD = await newSession(lab); const sundayOps = () => [makeOp({ op: 'add_locality', locality: 'Milano', provincia: null, evidence: 'Milano' }), makeOp({ op: 'set', field: 'dates', dates: ['2026-12-27'], evidence: 'domenica 27 dicembre' })];
const tD1 = await handle(turnReq(sidD, crypto.randomUUID(), 0, 'Giro domenica 27 dicembre a Milano'), A, deps(lab, { workingDays: WD, llmSteps: [{ kind: 'ok', ops: sundayOps() }] }));
const qD1 = (tD1.body.openQuestions as Array<Record<string, unknown>>)[0];
check(tD1.body.gate === 'needs_consent' && qD1?.kind === 'consent' && tD1.body.sessionRevision === 1, `${K} rifiuto: premessa needs_consent (${qD1?.id}), rev 1`, tD1.body);
const RNO = crypto.randomUUID(); const dNo = deps(lab, { workingDays: WD }); const tNo = await handle(turnReq(sidD, RNO, 1, { action: { type: 'answer', questionId: qD1.id as string, optionId: 'no' } }), A, dNo);
const qNo = (tNo.body.openQuestions as Array<Record<string, unknown>>)[0] ?? null, critNo = (tNo.body.result as Record<string, unknown>).criteria as Record<string, unknown>;
check(tNo.http === 200 && tNo.body.outcome === 'committed' && tNo.body.gate === 'blocked' && tNo.body.plan === null && dNo.planner.calls === 0 && dNo.llm!.calls === 0 && tNo.body.sessionRevision === 2 && valid(tNo.body), `${K} "no" → 200 committed blocked, nessun piano, zero planner, rev 2, body valido`, tNo.body);
check(!!qNo && qNo.kind !== 'consent' && qNo.kind === 'invalid_value' && qNo.id !== qD1.id && JSON.stringify((qNo.options as Array<Record<string, unknown>>).map(o => o.id)) === JSON.stringify(['drop:dates']) && tNo.body.openQuestionCount === 1, `${K} "no" → chiarimento (cambia o rimuovi la data), NON la stessa richiesta di consenso`, qNo);
check((critNo.consents as unknown[]).length === 0 && JSON.stringify(critNo.dates) === JSON.stringify(['2026-12-27']) && (tNo.body.notApplied as Array<Record<string, unknown>>).some(n => n.reason === 'refused_consent'), `${K} "no": nessun consenso registrato, data NON modificata dal server, notApplied refused_consent`, critNo);
const gsNo = await getState(lab, sidD);
check(gsNo.sessionRevision === 2 && gsNo.gate === 'blocked' && (gsNo.question as Record<string, unknown>).id === qNo!.id, `${K} get_state dopo "no": chiarimento persistito, rev 2`, gsNo);
const dNoR = deps(lab, { workingDays: WD }); const tNoR = await handle(turnReq(sidD, RNO, 1, { action: { type: 'answer', questionId: qD1.id as string, optionId: 'no' } }), A, dNoR);
check(tNoR.diagnostics.claim === 'cached' && JSON.stringify(tNoR.body) === JSON.stringify(tNo.body) && dNoR.planner.calls === 0 && dNoR.llm!.calls === 0 && (await getState(lab, sidD)).sessionRevision === 2, `${K} replay stesso requestId del "no" → cached byte-identico, +0`);
const dSide = deps(lab, { workingDays: WD, llmSteps: [{ kind: 'ok', locality: 'Monza' }] }); const tSide = await handle(turnReq(sidD, crypto.randomUUID(), 2, 'Aggiungi anche Monza'), A, dSide);
const qSide = (tSide.body.openQuestions as Array<Record<string, unknown>>)[0] ?? null, critSide = (tSide.body.result as Record<string, unknown>).criteria as Record<string, unknown>;
check(tSide.http === 200 && tSide.body.gate === 'pending_question' && qSide?.id === qNo!.id && tSide.body.openQuestionCount === 1 && dSide.planner.calls === 0 && tSide.body.sessionRevision === 3 && valid(tSide.body), `${K} messaggio non pertinente dopo il "no" → stesso chiarimento aperto (nessuna nuova richiesta di consenso), zero planner, rev 3`, tSide.body);
check(((critSide.area as Record<string, unknown>).localities as unknown[]).length === 2 && JSON.stringify(critSide.dates) === JSON.stringify(['2026-12-27']) && (critSide.consents as unknown[]).length === 0, `${K} messaggio non pertinente applicato (Monza), data e rifiuto conservati`, critSide);
const dBadNo = deps(lab, { workingDays: WD }); const tBadNo = await handle(turnReq(sidD, crypto.randomUUID(), 3, { action: { type: 'answer', questionId: qNo!.id as string, optionId: 'no' } }), A, dBadNo);
check(tBadNo.http === 400 && tBadNo.body.errorCode === 'invalid_request' && tBadNo.body.outcome === 'committed' && (await getState(lab, sidD)).sessionRevision === 3 && valid(tBadNo.body), `${K} "no" al chiarimento (opzione non prevista) → 400 invalid_request D, stato invariato`, tBadNo.body);
const dDate = deps(lab, { workingDays: WD }); const tDate = await handle(turnReq(sidD, crypto.randomUUID(), 3, { action: { type: 'set_date', date: '2026-12-21' } }), A, dDate);
const critDate = (tDate.body.result as Record<string, unknown>).criteria as Record<string, unknown>;
check(tDate.http === 200 && tDate.body.gate === 'planned' && dDate.planner.calls === 1 && tDate.body.openQuestionCount === 0 && tDate.body.sessionRevision === 4 && JSON.stringify(critDate.dates) === JSON.stringify(['2026-12-21']) && valid(tDate.body), `${K} cambio data esplicito (lunedì) → chiarimento risolto, planned, rev 4`, tDate.body);
const dBack = deps(lab, { workingDays: WD }); const tBack = await handle(turnReq(sidD, crypto.randomUUID(), 4, { action: { type: 'set_date', date: '2026-12-27' } }), A, dBack);
check(tBack.http === 200 && tBack.body.gate === 'blocked' && dBack.planner.calls === 0 && (tBack.body.openQuestions as Array<Record<string, unknown>>)[0]?.kind === 'invalid_value' && tBack.body.sessionRevision === 5, `${K} ritorno alla data rifiutata → rifiuto conservato: blocked con chiarimento, nessuna nuova richiesta di consenso`, tBack.body);
const sidE = await newSession(lab);
const tE1 = await handle(turnReq(sidE, crypto.randomUUID(), 0, 'Giro domenica 27 dicembre a Milano'), A, deps(lab, { workingDays: WD, llmSteps: [{ kind: 'ok', ops: sundayOps() }] }));
const qE1 = (tE1.body.openQuestions as Array<Record<string, unknown>>)[0];
const tE2 = await handle(turnReq(sidE, crypto.randomUUID(), 1, { action: { type: 'answer', questionId: qE1.id as string, optionId: 'no' } }), A, deps(lab, { workingDays: WD }));
const qE2 = (tE2.body.openQuestions as Array<Record<string, unknown>>)[0];
const dDrop = deps(lab, { workingDays: WD }); const tE3 = await handle(turnReq(sidE, crypto.randomUUID(), 2, { action: { type: 'answer', questionId: qE2.id as string, optionId: 'drop:dates' } }), A, dDrop);
const critE3 = (tE3.body.result as Record<string, unknown>).criteria as Record<string, unknown>, appliedE3 = (tE3.body.result as Record<string, unknown>).applied as Array<Record<string, unknown>>;
check(tE3.http === 200 && tE3.body.gate !== 'needs_consent' && tE3.body.openQuestionCount === 0 && tE3.body.sessionRevision === 3 && JSON.stringify(critE3.dates) === '[]' && (critE3.consents as unknown[]).length === 0 && appliedE3[0]?.op === 'clear' && appliedE3[0]?.field === 'dates' && valid(tE3.body), `${K} "no" poi drop:dates → data rimossa dall'utente (non dal server), nessun consenso, rev 3`, tE3.body);
// TEXTUAL refusal (semantic-1.0.1 decline_consent, LLM MOCKED): same rules as the button; rejected declines leave the consent question open and register nothing
const startSunday = async () => { const s = await newSession(lab); const t = await handle(turnReq(s, crypto.randomUUID(), 0, 'Giro domenica 27 dicembre a Milano'), A, deps(lab, { workingDays: WD, llmSteps: [{ kind: 'ok', ops: sundayOps() }] })); return { s, q: (t.body.openQuestions as Array<Record<string, unknown>>)[0] }; };
const decl = (kind = 'non_working_day', evidence = 'No grazie') => makeOp({ op: 'decline_consent', consent: kind as 'non_working_day', evidence });
const say = (s: string, rev: number, msg: string, ops: ReturnType<typeof makeOp>[] | null, clar: Record<string, unknown> | null = null, rid = crypto.randomUUID()) => { const d = deps(lab, { workingDays: WD, llmSteps: ops ? [{ kind: 'ok', ops }] : [{ kind: 'raw', text: JSON.stringify({ operations: [], clarification: clar }) }] }); return handle(turnReq(s, rid, rev, msg), A, d).then(t => ({ t, d })); };
const crit = (t: { body: Record<string, unknown> }) => (t.body.result as Record<string, unknown>).criteria as Record<string, unknown>;
const topQ = (t: { body: Record<string, unknown> }) => (t.body.openQuestions as Array<Record<string, unknown>>)[0] ?? null;
{ const { s, q } = await startSunday(); const RT = crypto.randomUUID(); const { t, d } = await say(s, 1, 'No grazie', [decl()], null, RT);
  check(t.http === 200 && t.body.gate === 'blocked' && topQ(t)?.kind === 'invalid_value' && (crit(t).consents as unknown[]).length === 0 && JSON.stringify(crit(t).dates) === '["2026-12-27"]' && d.planner.calls === 0 && t.body.sessionRevision === 2 && (t.body.notApplied as Array<Record<string, unknown>>).some(n => n.reason === 'refused_consent') && valid(t.body), `${K} testo «No grazie» → decline_consent accettata: rifiuto conservato, blocked + chiarimento, nessun consenso/piano, data invariata, rev 2`, t.body);
  const { t: tr, d: dr } = await say(s, 1, 'No grazie', [decl()], null, RT);
  check(tr.diagnostics.claim === 'cached' && JSON.stringify(tr.body) === JSON.stringify(t.body) && dr.llm!.calls === 0 && dr.planner.calls === 0, `${K} replay stesso requestId del rifiuto testuale → cached byte-identico, zero LLM/planner`);
  const { t: ts, d: dsd } = await say(s, 2, 'Aggiungi anche Monza', [makeOp({ op: 'add_locality', locality: 'Monza', evidence: 'Monza' })]);
  check(ts.body.gate === 'pending_question' && topQ(ts)?.id === topQ(t)?.id && dsd.planner.calls === 0 && ts.body.sessionRevision === 3 && (crit(ts).consents as unknown[]).length === 0, `${K} dopo rifiuto testuale: messaggio non pertinente → stesso chiarimento, nessuna nuova richiesta di consenso, rev 3`, ts.body);
  void q; }
{ const { s, q } = await startSunday(); const { t, d } = await say(s, 1, 'No grazie', null, { reason: 'unrelated', question: 'Non ho capito: vuoi includere domenica?' });
  const qs = t.body.openQuestions as Array<Record<string, unknown>>;
  check(t.http === 200 && t.body.gate === 'pending_question' && qs.length === 2 && qs[0].kind === 'unclear' && qs[1].id === q.id && qs[1].kind === 'consent' && d.planner.calls === 0 && t.body.plan === null && (crit(t).consents as unknown[]).length === 0 && t.body.sessionRevision === 2 && valid(t.body), `${K} fallback: LLM senza operazione → chiarimento sopra la domanda consent (ancora pendente), nessun rifiuto dedotto, nessun piano`, t.body); }
{ const { s, q } = await startSunday(); const { t } = await say(s, 1, 'No grazie', [decl('extra_days')]);
  check(t.body.gate === 'pending_question' && topQ(t)?.id === q.id && topQ(t)?.kind === 'consent' && ((t.body.result as Record<string, unknown>).rejected as unknown[]).length === 1 && (crit(t).consents as unknown[]).length === 0 && t.body.sessionRevision === 2, `${K} decline di tipo diverso → respinto, domanda consent originale aperta, nulla registrato`, t.body);
  const { t: ty, d: dy } = await handle(turnReq(s, crypto.randomUUID(), 2, { action: { type: 'answer', questionId: q.id as string, optionId: 'yes' } }), A, deps(lab, { workingDays: WD })).then(t => ({ t, d: null }));
  check(ty.body.gate === 'planned' && ty.body.sessionRevision === 3 && (crit(ty).consents as unknown[]).length === 1, `${K} … e la domanda resta rispondibile: «yes» → consenso → planned (nessun rifiuto era stato registrato)`, ty.body); void dy; }
{ const { s, q } = await startSunday(); const { t } = await say(s, 1, 'sì no', [makeOp({ op: 'grant_consent', consent: 'non_working_day', evidence: 'sì' }), decl('non_working_day', 'no')]);
  check(t.body.gate === 'pending_question' && topQ(t)?.id === q.id && ((t.body.result as Record<string, unknown>).rejected as unknown[]).length === 2 && (crit(t).consents as unknown[]).length === 0 && t.body.sessionRevision === 2 && valid(t.body), `${K} grant + decline stesso tipo → entrambi respinti, domanda consent aperta, né consenso né rifiuto`, t.body); }
{ const { s, q } = await startSunday(); const { t } = await say(s, 1, 'No grazie', [decl('non_working_day', 'rifiuto inventato')]);
  check(t.body.gate === 'pending_question' && topQ(t)?.id === q.id && ((t.body.result as Record<string, unknown>).rejected as Array<Record<string, unknown>>)[0]?.reason?.toString().includes('citazione') && (crit(t).consents as unknown[]).length === 0 && t.body.sessionRevision === 2, `${K} decline con citazione assente → respinto, domanda consent aperta`, t.body); }
{ const { s, q } = await startSunday(); const { t } = await say(s, 1, 'No, niente Milano', [makeOp({ op: 'remove_locality', locality: 'Milano', evidence: 'niente Milano' })]);
  check(t.body.gate === 'pending_question' && topQ(t)?.id === q.id && (crit(t).consents as unknown[]).length === 0 && t.body.sessionRevision === 2 && valid(t.body), `${K} negazione riferita ad altro criterio → operazione pertinente, consent pendente, nessun rifiuto`, t.body); }
// D-U2C-03: planner infeasible → PERSISTED clarification scoped on the criterion the planner identified; criteria never edited by the server; ≤1 planner call per turn
const sid2 = await newSession(lab); const d6 = deps(lab); d6.planner = plannerMock('infeasible', 'area', 'MOCKED nessun cliente nell\'area');
const t6 = await handle(turnReq(sid2, crypto.randomUUID(), 0), A, d6); const q6 = topQ(t6);
check(t6.http === 200 && t6.body.gate === 'blocked' && t6.body.plan === null && d6.planner.calls === 1 && q6?.kind === 'invalid_value' && (q6.options as unknown[]).length === 0 && JSON.stringify(t6.body.notApplied) === JSON.stringify([{ reason: 'MOCKED nessun cliente nell\'area', criterion: 'area' }]) && t6.body.sessionRevision === 1 && valid(t6.body), `${K} infeasible(area) → blocked con domanda persistita (nessuna opzione drop per l'area), notApplied dal planner, 1 planner, rev 1`, t6.body);
check(((crit(t6).area as Record<string, unknown>).localities as unknown[]).length === 1 && (await getState(lab, sid2)).gate === 'blocked' && ((await getState(lab, sid2)).question as Record<string, unknown>)?.id === q6?.id, `${K} infeasible: criteri NON modificati dal server, domanda nello snapshot`);
const dI = deps(lab, { llmSteps: [{ kind: 'ok', locality: 'Monza' }] }); const tI = await handle(turnReq(sid2, crypto.randomUUID(), 1, 'Aggiungi anche Monza'), A, dI);
check(tI.body.gate === 'planned' && dI.planner.calls === 1 && tI.body.sessionRevision === 2 && tI.body.openQuestionCount === 0 && valid(tI.body), `${K} infeasible(area) risolta da un'operazione sull'area → planner reinvocato UNA volta nello stesso turno → planned, rev 2`, tI.body);
const CRIT = { dates: ['drop:dates'], time_window: ['drop:start_time', 'drop:end_time'], visit_filter: ['drop:visit_filter'], lodging: ['drop:lodging'], area: [], other: [] } as const;
for (const [c, opts] of Object.entries(CRIT)) { const s = await newSession(lab); const d = deps(lab); d.planner = plannerMock('infeasible', c as keyof typeof CRIT, `MOCKED ${c}`);
  const t = await handle(turnReq(s, crypto.randomUUID(), 0), A, d); const q = topQ(t);
  check(t.body.gate === 'blocked' && q?.kind === 'invalid_value' && JSON.stringify((q.options as Array<Record<string, unknown>>).map(o => o.id)) === JSON.stringify(opts) && (t.body.notApplied as Array<Record<string, unknown>>)[0]?.criterion === c && d.planner.calls === 1 && valid(t.body), `${K} mappa criterio→opzioni: ${c} → [${opts.join(',')}], criterion non reinterpretato`, q); }
{ const s = await newSession(lab); const d = deps(lab, { llmSteps: [{ kind: 'ok', ops: [makeOp({ op: 'add_locality', locality: 'Milano', evidence: 'Milano' }), makeOp({ op: 'set', field: 'dates', dates: ['2026-12-21'], evidence: 'lunedì 21' })] }] }); d.planner = plannerMock('infeasible', 'dates', 'MOCKED nessuna disponibilità nella data');
  const t = await handle(turnReq(s, crypto.randomUUID(), 0, 'Milano lunedì 21'), A, d); const q = topQ(t)!;
  const dS = deps(lab, { llmSteps: [{ kind: 'ok', locality: 'Monza' }] }); dS.planner = plannerMock('infeasible', 'dates'); const tS = await handle(turnReq(s, crypto.randomUUID(), 1, 'Aggiungi anche Monza'), A, dS);
  check(tS.body.gate === 'pending_question' && topQ(tS)?.id === q.id && dS.planner.calls === 0 && tS.body.sessionRevision === 2 && JSON.stringify(crit(tS).dates) === '["2026-12-21"]', `${K} infeasible(dates): messaggio non pertinente → domanda aperta, NESSUN planner, data intatta, rev 2`, tS.body);
  const dD = deps(lab); const tD = await handle(turnReq(s, crypto.randomUUID(), 2, { action: { type: 'answer', questionId: q.id as string, optionId: 'drop:dates' } }), A, dD);
  check(tD.body.gate === 'planned' && dD.planner.calls === 1 && tD.body.sessionRevision === 3 && JSON.stringify(crit(tD).dates) === '[]' && tD.body.openQuestionCount === 0 && valid(tD.body), `${K} infeasible(dates): drop:dates (scelta dell'utente) → planner 1 → planned, rev 3`, tD.body);
  const dR = deps(lab); dR.planner = plannerMock('infeasible', 'dates'); const tR = await handle(turnReq(s, q.id as string === 'x' ? '' : crypto.randomUUID(), 3, { action: { type: 'set_date', date: '2026-12-21' } }), A, dR);
  check(tR.body.gate === 'blocked' && dR.planner.calls === 1 && tR.body.sessionRevision === 4 && JSON.stringify(crit(tR).dates) === '["2026-12-21"]', `${K} infeasible di nuovo: data rimessa dall'utente, planner 1, blocked, criteri non toccati`, tR.body); }
{ const s = await newSession(lab); const d = deps(lab, { llmSteps: [{ kind: 'ok', ops: [makeOp({ op: 'add_locality', locality: 'Milano', evidence: 'Milano' }), makeOp({ op: 'set', field: 'start_time', text: '09:00', evidence: 'dalle 9' }), makeOp({ op: 'set', field: 'end_time', text: '12:00', evidence: 'alle 12' })] }] }); d.planner = plannerMock('infeasible', 'time_window', 'MOCKED finestra troppo stretta');
  const t = await handle(turnReq(s, crypto.randomUUID(), 0, 'Milano dalle 9 alle 12'), A, d); const q = topQ(t)!;
  check(t.body.gate === 'blocked' && q.kind === 'invalid_value' && crit(t).startTime === '09:00' && crit(t).endTime === '12:00', `${K} infeasible(time_window): orari intatti, domanda aperta`);
  const dE = deps(lab, { llmSteps: [{ kind: 'ok', ops: [makeOp({ op: 'set', field: 'end_time', text: '18:00', evidence: 'alle 18' })] }] }); const tE = await handle(turnReq(s, crypto.randomUUID(), 1, 'Finiamo alle 18'), A, dE);
  check(tE.body.gate === 'planned' && dE.planner.calls === 1 && tE.body.sessionRevision === 2 && crit(tE).endTime === '18:00' && crit(tE).startTime === '09:00' && tE.body.openQuestionCount === 0 && valid(tE.body), `${K} time_window risolta modificando la FINE (slot gemello) → planner 1 → planned, rev 2`, tE.body);
  const s2 = await newSession(lab); const d2 = deps(lab, { llmSteps: [{ kind: 'ok', ops: [makeOp({ op: 'add_locality', locality: 'Milano', evidence: 'Milano' }), makeOp({ op: 'set', field: 'start_time', text: '09:00', evidence: 'dalle 9' })] }] }); d2.planner = plannerMock('infeasible', 'time_window');
  const t2 = await handle(turnReq(s2, crypto.randomUUID(), 0, 'Milano dalle 9'), A, d2); const q2 = topQ(t2)!;
  const dB = deps(lab); const tB2 = await handle(turnReq(s2, crypto.randomUUID(), 1, { action: { type: 'answer', questionId: q2.id as string, optionId: 'drop:start_time' } }), A, dB);
  check(tB2.body.gate === 'planned' && dB.planner.calls === 1 && crit(tB2).startTime === null && tB2.body.sessionRevision === 2, `${K} time_window risolta rimuovendo l'INIZIO (drop:start_time) → planned`, tB2.body); }
{ const s = await newSession(lab); const d = deps(lab); d.planner = plannerMock('infeasible', 'other', 'MOCKED causa non identificabile');
  const t = await handle(turnReq(s, crypto.randomUUID(), 0), A, d); const q = topQ(t)!;
  check(t.body.gate === 'blocked' && (q.options as unknown[]).length === 0 && String(q.text).includes('Riformula') && (t.body.notApplied as Array<Record<string, unknown>>)[0]?.criterion === 'other' && !String(q.text).includes('invariati'), `${K} infeasible(other): nessuna causa attribuita, percorso esplicito riformula/annulla/reset nel testo`, q);
  const dX = deps(lab); dX.planner = plannerMock('infeasible', 'other', 'MOCKED causa non identificabile'); const tX = await handle(turnReq(s, crypto.randomUUID(), 1, { action: { type: 'dismiss_question', questionId: q.id as string } }), A, dX); const qX = topQ(tX)!;
  check(tX.body.gate === 'blocked' && dX.planner.calls === 1 && tX.body.openQuestionCount === 1 && qX.id !== q.id && String(qX.text).includes('invariati') && tX.body.sessionRevision === 2, `${K} other: annulla (dismiss) → planner riprova UNA volta → ancora infeasible → UNA domanda con nota informativa «invariati», rev 2`, tX.body);
  const dY = deps(lab, { llmSteps: [{ kind: 'ok', locality: 'Monza' }] }); const tY = await handle(turnReq(s, crypto.randomUUID(), 2, 'Proviamo con Monza'), A, dY);
  check(tY.body.gate === 'planned' && dY.planner.calls === 1 && tY.body.sessionRevision === 3 && tY.body.openQuestionCount === 0, `${K} other: riformulazione → planner 1 → planned (nessun blocco permanente)`, tY.body);
  const s3 = await newSession(lab); const d3 = deps(lab); d3.planner = plannerMock('infeasible', 'other'); const t3 = await handle(turnReq(s3, crypto.randomUUID(), 0), A, d3);
  const dZ = deps(lab); const tZ = await handle(turnReq(s3, crypto.randomUUID(), 1, { action: { type: 'reset' } }), A, dZ);
  check(t3.body.gate === 'blocked' && tZ.http === 200 && tZ.body.openQuestionCount === 0 && tZ.body.sessionRevision === 2 && ((crit(tZ).area ?? null) === null) && valid(tZ.body), `${K} other: reset → domanda chiusa, criteri azzerati dall'utente, rev 2`, tZ.body); }
// D-U2C-02 (semantic-1.2): identity kept separately when valid, null when absent/invalid, correlationId identifies the error; claim loss stays recoverable
{ const bad1 = await handle({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: 'not-a-uuid', expectedRevision: 0, message: 'x' }, A, deps(lab));
  check(bad1.http === 400 && bad1.body.errorCode === 'invalid_request' && bad1.body.sessionId === null && bad1.body.requestId === null && isUuid(bad1.body.correlationId) && valid(bad1.body), `${K} identificatori assenti/invalidi → null (nessun UUID fabbricato), correlationId presente`, bad1.body);
  const bad2 = await handle({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid, requestId: 'zzz', expectedRevision: 0, message: 'x' }, A, deps(lab));
  check(bad2.body.sessionId === sid && bad2.body.requestId === null && bad2.body.errorCode === 'invalid_request', `${K} sessionId valido conservato, requestId invalido → null`, bad2.body);
  const gpx4 = await handle({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, sessionId: sidB, planId: plan1.planId }, A, deps(lab));
  check(gpx4.body.sessionId === sidB && gpx4.body.requestId === null && isUuid(gpx4.body.correlationId) && gpx4.body.errorCode === 'plan_unavailable', `${K} errore non-turno: sessionId ricevuto conservato (non implica accesso), requestId null, correlationId`, gpx4.body);
  const old = await handle({ operation: 'turn', contractVersion: 'semantic-1.1', sessionId: sid, requestId: crypto.randomUUID(), expectedRevision: 0, message: 'x' }, A, deps(lab));
  check(old.http === 400 && old.body.errorCode === 'unsupported_contract' && old.body.sessionId === sid && isUuid(old.body.requestId) && valid(old.body), `${K} richiesta semantic-1.1 → unsupported_contract (nessuna compatibilità automatica), identità ricevute conservate`, old.body);
  check(JSON.stringify((cap.body.supportedVersions)) === JSON.stringify(['semantic-1.2']) && JSON.stringify(cap.body.previousVersions) === JSON.stringify(['semantic-1.1']), `${K} capabilities: versione servita 1.2, 1.1 dichiarata solo come precedente`, cap.body);
  check(!('correlationId' in t1.body) && isUuid(t3.body.correlationId) && isUuid(tBadNo.body.correlationId) && t3.body.sessionId === sid, `${K} successo senza correlationId; errori committed con correlationId e identità reale`, { t3: t3.body.correlationId });
  const sL = await newSession(lab); const RL = crypto.randomUUID();
  const dL = deps(lab, { store: faultyStore(lab.store, { claim: 'ack_lost' }) }); const tL = await handle(turnReq(sL, RL, 0), A, dL);
  check(tL.http === 503 && tL.body.errorCode === 'outcome_unknown' && tL.body.outcome === 'unknown' && tL.body.sessionId === sL && tL.body.requestId === RL && tL.body.nextAction === 'get_request' && isUuid(tL.body.correlationId) && valid(tL.body), `${K} risposta persa DURANTE la claim → outcome_unknown con identificatori ORIGINALI, nextAction get_request (nessun nuovo requestId)`, tL.body);
  const grL = await handle({ operation: 'get_request', contractVersion: TRANSPORT_VERSION, sessionId: sL, requestId: RL }, A, deps(lab));
  check(valid(grL.body) && (grL.body.receipt as Record<string, unknown>).status === 'pending', `${K} get_request con gli identificatori originali → ricevuta pending (la claim era avvenuta)`, grL.body);
  await lab.expireLease(sL, RL); const dL2 = deps(lab); const tL2 = await handle(turnReq(sL, RL, 0), A, dL2);
  check(tL2.http === 200 && tL2.diagnostics.claim === 'takeover' && tL2.body.gate === 'planned' && tL2.body.sessionRevision === 1, `${K} stesso requestId dopo scadenza lease → takeover → committed (recupero senza nuovo requestId)`, tL2.body);
  const sM = await newSession(lab); const RM = crypto.randomUUID(); const dM = deps(lab, { store: faultyStore(lab.store, { claim: 'throw_before' }) }); const tM = await handle(turnReq(sM, RM, 0), A, dM);
  check(tM.body.errorCode === 'outcome_unknown' && tM.body.sessionId === sM && tM.body.requestId === RM, `${K} errore di rete prima della claim (esito non osservabile) → outcome_unknown, mai internal_error_unaccepted`, tM.body);
  const grM = await handle({ operation: 'get_request', contractVersion: TRANSPORT_VERSION, sessionId: sM, requestId: RM }, A, deps(lab));
  const tM2 = await handle(turnReq(sM, RM, 0), A, deps(lab));
  check((grM.body.receipt as Record<string, unknown>).status === 'not_found' && tM2.diagnostics.claim === 'new' && tM2.body.gate === 'planned', `${K} … get_request → not_found → retry stesso requestId → new → committed`, tM2.body);
  if (lab.expireDeadline) { const sD = await newSession(lab); const RD = crypto.randomUUID(); await lab.store.claim(A, sD, RD, await payloadHash(turnReq(sD, RD, 0)), 0); await lab.expireDeadline(sD, RD);
    const tD = await handle(turnReq(sD, RD, 0), A, deps(lab));
    check(tD.http === 503 && tD.body.errorCode === 'processing_expired' && tD.diagnostics.claim === 'deadline_finalized' && tD.body.contractVersion === 'semantic-1.2' && !('correlationId' in tD.body) && tD.body.sessionId === sD && valid(tD.body), `${K} L2: body terminale COSTRUITO DAL SQL (processing_expired) per una sessione semantic-1.2 → valido 1.2 (identità reale, nessun correlationId richiesto)`, tD.body); } }
// revalidation context_changed → 409 D, state unchanged
const d7 = deps(lab); d7.revalidation = { async check() { return { ok: false, code: 'context_changed' }; } };
const t7 = await handle(turnReq(sid2, crypto.randomUUID(), 2), A, d7);
check(t7.http === 409 && t7.body.errorCode === 'context_changed' && (await getState(lab, sid2)).sessionRevision === 2 && valid(t7.body), `${K} rivalidazione fallita → 409 context_changed, stato invariato (T17)`, t7.body);
// other caller / unknown session → non-enumerating
const tb = await handle(turnReq(sid2, crypto.randomUUID(), 2), B, deps(lab));
check(tb.http === 403 && tb.body.errorCode === 'forbidden_session' && valid(tb.body), `${K} altro caller → 403 forbidden_session`, tb.body);
const tu = await handle(turnReq(crypto.randomUUID(), crypto.randomUUID(), 0), A, deps(lab));
check(tu.http === 403 && tu.body.errorCode === 'forbidden_session' && valid(tu.body), `${K} sessione inventata → 403, nessuna creazione (T02)`);
const gsB_ = await handle({ operation: 'get_state', contractVersion: TRANSPORT_VERSION, sessionId: sid }, B, deps(lab));
check(gsB_.http === 403 && gsB_.body.errorCode === 'forbidden_session' && valid(gsB_.body), `${K} get_state altro caller → 403 valido`);
// get_plan: sessionId and planId of TWO sessions of the same user → rejected (plan_unavailable), never leaks the other session's plan
const gpx = await handle({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, sessionId: sidB, planId: plan1.planId }, A, deps(lab));
check(gpx.http === 404 && gpx.body.errorCode === 'plan_unavailable' && gpx.body.outcome === 'not_accepted' && !('plan' in gpx.body && gpx.body.plan) && valid(gpx.body), `${K} get_plan con planId di un'altra sessione dello stesso utente → 404 plan_unavailable`, gpx.body);
const gpx2 = await handle({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, sessionId: sid, planId: crypto.randomUUID() }, A, deps(lab));
check(gpx2.http === 404 && gpx2.body.errorCode === 'plan_unavailable' && valid(gpx2.body), `${K} get_plan planId inesistente → 404 plan_unavailable`);
const gpx3 = await handle({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, sessionId: sid, planId: plan1.planId }, B, deps(lab));
check(gpx3.http === 403 && gpx3.body.errorCode === 'forbidden_session' && valid(gpx3.body), `${K} get_plan altro caller → 403 forbidden_session (sessione prima del piano)`);
const gpok = await handle({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, sessionId: sid, planId: plan1.planId }, A, deps(lab));
check(gpok.http === 200 && gpok.body.isCurrentRevision === false && valid(gpok.body), `${K} get_plan coerente: piano della sessione, non più revisione corrente`);
// T34: 10 identical POSTs in parallel → one commit, others in_progress/cached; then sequential retry → cached
const sid3 = await newSession(lab); const R34 = crypto.randomUUID(); const ds = Array.from({ length: 10 }, () => deps(lab));
const par = await Promise.all(ds.map(d => handle(turnReq(sid3, R34, 0), A, d)));
const outs = par.map(p => p.diagnostics.claim), llmTotal = ds.reduce((n, d) => n + d.llm!.calls, 0), planTotal = ds.reduce((n, d) => n + d.planner.calls, 0);
check(outs.filter(o => o === 'new').length === 1 && outs.every(o => o === 'new' || o === 'in_progress' || o === 'cached') && llmTotal === 1 && planTotal === 1, `${K} 10 POST paralleli → 1 new, altri in_progress/cached; 1 LLM, 1 planner (T34)`, { outs, llmTotal, planTotal });
const seq = await handle(turnReq(sid3, R34, 0), A, deps(lab)); const win = par.find(p => p.diagnostics.claim === 'new')!;
check(seq.diagnostics.claim === 'cached' && JSON.stringify(seq.body) === JSON.stringify(win.body) && seq.body.sessionRevision === 1, `${K} retry sequenziale → cached identico al vincitore`);
check(par.filter(p => p.diagnostics.claim === 'in_progress').every(p => p.http === 409 && p.body.errorCode === 'request_in_progress' && typeof p.body.retryAfterMs === 'number' && valid(p.body)), `${K} in_progress → 409 request_in_progress recuperabile con retryAfterMs`);
// T04: two different requests at the same revision in parallel → one committed, one 409 revision_conflict, one plan
const [x, y] = await Promise.all([handle(turnReq(sid3, crypto.randomUUID(), 1, 'Vai a Milano'), A, deps(lab)), handle(turnReq(sid3, crypto.randomUUID(), 1, 'Vai a Monza'), A, deps(lab))]);
const codes = [x, y].map(p => p.body.errorCode ?? 'ok').sort();
check(JSON.stringify(codes) === JSON.stringify(['ok', 'revision_conflict']) && (await getState(lab, sid3)).sessionRevision === 2 && [x, y].every(p => valid(p.body)), `${K} commit concorrenti stessa base → 1 committed + 1 409, totale +1 (T04)`, { codes });
done(`U2C TURN[${lab.kind}]`);
