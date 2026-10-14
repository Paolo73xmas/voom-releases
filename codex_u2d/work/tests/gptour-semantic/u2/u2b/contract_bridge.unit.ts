// U2-b contract bridge: the terminal bodies persisted by the SQL layer (SQL-built processing_expired / revision_conflict and
// handler bodies stamped by commit_success / finish_error) must be valid semantic-1.1 TurnResponse objects as stored,
// because replay returns them to the client as-is. Also asserts the SQL policy mirror equals ERROR_POLICIES (errors.ts).
// Input: the export written by verify_u2b.py (lab data, synthetic). No network, no persistence, no LLM.
import { ERROR_POLICIES, TRANSPORT_VERSION, VALIDATABLE_TRANSPORT_VERSIONS, validateTransportResponse, type ErrorCode } from '../../../../supabase/functions/_shared/gptour-semantic-transport/index.ts';

type Terminal = { name: string; httpStatus: number; errorCode: ErrorCode | null; finalRevision: number; planId: string | null; requestId: string; responseBody: string };
type Export = { contractVersion: string; sessionId: string; terminalBodies: Terminal[]; sqlPolicies: Record<string, Record<string, unknown>>;
  sqlPolicyUnknownIsNull: boolean; getPlan: { planId: string; sessionId: string; planRevision: number; plan: Record<string, unknown>; expiresAt: string }; cachedReplayIdentical: boolean };

const path = Deno.args[0];
if (!path) throw new Error('usage: contract_bridge.unit.ts <u2b_contract_export.json>');
const exp = JSON.parse(await Deno.readTextFile(path)) as Export;
let pass = 0, fail = 0;
const check = (ok: boolean, label: string, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} [B14-deno-raccordo] ${label}${ok ? '' : ' :: ' + detail.slice(0, 300)}`); };

check((VALIDATABLE_TRANSPORT_VERSIONS as readonly string[]).includes(exp.contractVersion), `export prodotto per un contratto validabile (${exp.contractVersion}; servito: ${TRANSPORT_VERSION}; il lab U2-b resta la prova SQL della versione 1.1)`, exp.contractVersion);
for (const t of exp.terminalBodies) {
  const body = JSON.parse(t.responseBody) as Record<string, unknown>;
  const v = validateTransportResponse(body);
  check(v.ok, `${t.name}: body persistito valido per validateTransportResponse`, v.ok ? '' : JSON.stringify(v.issues));
  check(body.operation === 'turn' && body.sessionId === exp.sessionId && body.requestId === t.requestId, `${t.name}: identità sessione/request nel body`, JSON.stringify([body.sessionId, body.requestId]));
  check(body.errorCode === t.errorCode, `${t.name}: errorCode del body = esito persistito`, String(body.errorCode));
  const expectedHttp = t.errorCode ? ERROR_POLICIES[t.errorCode].httpStatus : 200;
  check(t.httpStatus === expectedHttp, `${t.name}: http_status persistito = policy del contratto (${expectedHttp})`, String(t.httpStatus));
  check(body.sessionRevision === t.finalRevision, `${t.name}: sessionRevision del body = final_revision della request`, `${body.sessionRevision} vs ${t.finalRevision}`);
  if (t.errorCode) {
    const p = ERROR_POLICIES[t.errorCode];
    check(body.outcome === p.outcome && body.nextAction === p.nextAction && body.retryableSameRequest === p.retryableSameRequest, `${t.name}: outcome/nextAction/retryable = ERROR_POLICIES`, JSON.stringify([body.outcome, body.nextAction, body.retryableSameRequest]));
  }
  const plan = body.plan as Record<string, unknown> | null;
  if (t.planId) check(plan !== null && plan.planId === t.planId && plan.sessionId === exp.sessionId && plan.sessionRevision === t.finalRevision, `${t.name}: plan.planId = planId della ricevuta, identità/revisione coerenti`, JSON.stringify(plan && [plan.planId, plan.sessionRevision]));
  else check(plan === null, `${t.name}: nessun piano nel body senza planId persistito`, JSON.stringify(plan));
}
for (const code of ['processing_expired', 'revision_conflict'] as const) {
  const sqlPol = exp.sqlPolicies[code], tsPol = ERROR_POLICIES[code] as unknown as Record<string, unknown>;
  const same = Object.keys(tsPol).length === Object.keys(sqlPol).length && Object.entries(tsPol).every(([k, v]) => sqlPol[k] === v);
  check(same, `policy SQL '${code}' identica a ERROR_POLICIES (errors.ts)`, JSON.stringify([sqlPol, tsPol]));
}
check(exp.sqlPolicyUnknownIsNull, 'il SQL non possiede policy per i codici del handler (nessuna duplicazione oltre i due codici emessi dal DB)');
const gp = validateTransportResponse({ operation: 'get_plan', contractVersion: TRANSPORT_VERSION, plan: exp.getPlan.plan, expiresAt: exp.getPlan.expiresAt, isCurrentRevision: true });
check(gp.ok && exp.getPlan.plan.planId === exp.getPlan.planId && exp.getPlan.plan.sessionRevision === exp.getPlan.planRevision, 'get_plan: piano persistito valido come Plan 1.0 dentro una risposta get_plan; planId/planRevision coerenti', gp.ok ? '' : JSON.stringify(gp.issues));
check(exp.cachedReplayIdentical, 'replay canonico: body cached byte-identico al body del commit, stesso planId');
console.log(`U2B DENO BRIDGE DONE checks=${pass + fail} pass=${pass} fail=${fail}`);
if (fail) Deno.exit(1);
