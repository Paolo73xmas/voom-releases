// Validator (U2-a minimal authorized correction) + U1 strictness: result.applied may carry server operations (evidence '') without inventing user citations;
// LLM outputs still require a non-empty literal citation. Positive and negative cases. No store, no network.
import { check, done } from './harness.ts';
import { turnFixture } from '../golden-cases.ts';
import { makeOp } from '../../../../supabase/functions/_shared/gptour-semantic/interpreter.ts';
import { validateLlmOutput } from '../../../../supabase/functions/_shared/gptour-semantic/schema.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
const withApplied = (ops: unknown[]) => { const t = turnFixture('planned') as unknown as Record<string, unknown>; return { ...t, result: { ...(t.result as Record<string, unknown>), applied: ops } }; };
const issues = (b: unknown) => { const v = validateTransportResponse(b); return v.ok ? [] : v.issues; };
const serverClear = makeOp({ op: 'clear', field: 'revenue' }), serverSet = makeOp({ op: 'set', field: 'dates', dates: ['2026-12-21'] }), llmOp = makeOp({ op: 'add_locality', locality: 'Milano', evidence: 'Milano' });
// positive
check(validateTransportResponse(withApplied([])).ok, 'applied vuoto valido');
check(validateTransportResponse(withApplied([llmOp])).ok, 'operazione LLM con citazione letterale valida');
check(validateTransportResponse(withApplied([serverClear])).ok, "operazione server clear (evidence '') valida: nessuna citazione inventata");
check(validateTransportResponse(withApplied([serverSet, llmOp, serverClear])).ok, 'mix server/LLM valido');
check(validateTransportResponse(withApplied([makeOp({ op: 'grant_consent', consent: 'non_working_day', dates: ['2026-12-27'] })])).ok, "grant_consent server (evidence '') valido");
// negative: provenance cannot be faked or malformed
check(JSON.stringify(issues(withApplied([{ ...serverClear, evidence: '   ' }]))) === JSON.stringify([{ path: '$.result.applied[0]', rule: 'operations_schema' }]), 'evidence solo spazi → respinta (né server né LLM)');
check(JSON.stringify(issues(withApplied([llmOp, { ...serverClear, evidence: 42 }]))) === JSON.stringify([{ path: '$.result.applied[1]', rule: 'operations_schema' }]), 'evidence non stringa → respinta con indice');
check(issues(withApplied([{ ...serverClear, evidence: 'x'.repeat(201) }])).length === 1, 'evidence oltre 200 caratteri → respinta');
const { evidence: _e, ...noEvidence } = serverClear; void _e;
check(issues(withApplied([noEvidence])).length === 1, 'evidence assente → respinta');
check(issues(withApplied([{ ...serverClear, extra: true }])).length === 1, 'chiave sconosciuta → respinta');
check(issues(withApplied([{ ...serverClear, op: 'drop_table' }])).length === 1, 'op fuori enum → respinta');
check(issues(withApplied([{ ...serverClear, field: 'password' }])).length === 1, 'field fuori enum → respinta');
check(issues(withApplied([{ ...llmOp, categories: ['vip'] }])).length === 1, 'categoria fuori enum → respinta');
check(issues(withApplied(Array.from({ length: 21 }, () => llmOp))).length === 1 && issues(withApplied(Array.from({ length: 21 }, () => llmOp)))[0].path === '$.result.applied', 'oltre MAX_OPERATIONS → respinta');
check(issues(withApplied('nope' as unknown as unknown[])).length === 1, 'applied non array → respinta');
// U1 LLM output validation unchanged: empty/whitespace citation rejected, literal citation accepted
check(!validateLlmOutput({ operations: [{ ...llmOp, evidence: '' }], clarification: null }).ok, "output LLM con evidence '' → respinto (U1 invariata)");
check(!validateLlmOutput({ operations: [{ ...llmOp, evidence: ' ' }], clarification: null }).ok, 'output LLM con evidence spazi → respinto');
check(!validateLlmOutput({ operations: [serverClear], clarification: null }).ok, 'operazione server-shaped presentata come output LLM → respinta');
check(validateLlmOutput({ operations: [llmOp], clarification: null }).ok, 'output LLM con citazione → accettato');
done('U2C VALIDATOR[contract]');
