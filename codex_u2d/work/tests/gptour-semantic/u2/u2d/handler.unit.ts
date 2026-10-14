// U2-d handler: ingress (method/flag/JWT/pilot/size/JSON), trusted identity from the verified token only, no catalog/settings before authorization,
// planner dependency failures → runtime recovery, Web/Mobile parity through two HTTP adapters, semantic-1.2 kit. L1 = memory store + fixture catalog; L2 = PostgREST store + RLS catalog.
import { A, B, CATALOG, check, deps, done, labConfig, makeLab, plannerMock } from '../u2c/harness.ts';
import { makeHttpHandler, type HandlerDiag } from '../../../../supabase/functions/gptour-semantic-v2/handler.ts';
import { makePostgrestCatalog, makePostgrestSettings } from '../../../../supabase/functions/gptour-semantic-v2/adapters/catalog-postgrest.ts';
import { DependencyError, type TurnDeps } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/ports.ts';
import type { TrustedCaller } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/store-port.ts';
import { TRANSPORT_VERSION } from '../../../../supabase/functions/_shared/gptour-semantic-transport/contract.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
const cfgLab = labConfig() as ReturnType<typeof labConfig> & { userJwtSecret?: string; pilotB?: boolean };
const lab = makeLab(cfgLab), K = `[${lab.kind}]`, SECRET = cfgLab.userJwtSecret ?? 'lab-synthetic-secret-not-a-real-key';
const C = { uid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
const b64 = (s: string | Uint8Array) => btoa(typeof s === 'string' ? s : String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function jwt(sub: string, o: { exp?: number; role?: string; secret?: string } = {}) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify({ sub, role: o.role ?? 'authenticated', aud: 'authenticated', exp: o.exp ?? Math.floor(lab.now() / 1000) + 600 }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(o.secret ?? SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${h}.${p}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`))))}`;
}
const JA = await jwt(A.uid), JB = await jwt(B.uid), JC = await jwt(C.uid);
let catalogLoads = 0, settingsLoads = 0, depsCalls = 0; let plannerOverride: TurnDeps['planner'] | null = null;
const depsFor = (caller: TrustedCaller, userJwt: string): TurnDeps => {
  depsCalls++; const d = deps(lab, { workingDays: [1, 2, 3, 4, 5] });
  const cat = lab.kind === 'postgrest' ? makePostgrestCatalog(cfgLab.baseUrl!, userJwt) : { async load() { return CATALOG; } };
  const set = lab.kind === 'postgrest' ? makePostgrestSettings(cfgLab.baseUrl!, userJwt) : { async workingDays() { return [1, 2, 3, 4, 5]; } };
  d.catalog = { async load(a) { catalogLoads++; return cat.load(a); } }; d.settings = { async workingDays(a) { settingsLoads++; return set.workingDays(a); } };
  if (plannerOverride) d.planner = plannerOverride as typeof d.planner; void caller; return d;
};
const diag: HandlerDiag[] = [];
const cfg = { enabled: true, allowedUids: new Set([A.uid, B.uid]), allowedOrigins: new Set<string>(), userJwtSecret: SECRET, maxBodyBytes: 4096 };
const H = makeHttpHandler(cfg, depsFor, lab.now, diag), Hoff = makeHttpHandler({ ...cfg, enabled: false }, depsFor, lab.now, diag);
const URL = 'http://lab/gptour-semantic-v2';
// two HTTP adapters: "web" (natural key order, browser-like headers) and "mobile" (reversed key order, whitespace, charset/user-agent)
const web = (body: unknown, tok: string | null = JA) => new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) });
const mobile = (body: unknown, tok: string | null = JA) => { const o = body as Record<string, unknown>; const rev = Object.fromEntries(Object.keys(o).reverse().map(k => [k, o[k]])); return new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'VOOM-Mobile/lab', Accept: 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(rev, null, 2) }); };
const send = async (r: Request) => { const res = await H(r); const text = await res.text(); return { status: res.status, text, body: JSON.parse(text) as Record<string, unknown> }; };
const valid = (b: unknown) => validateTransportResponse(b).ok;
const kit: Array<Record<string, unknown>> = [];
const VAR = new Set(['correlationId', 'acceptedAt', 'responseExpiresAt', 'expiresAt', 'planId', 'generatedAt', 'requestId', 'sessionId', 'lastPlanId', 'id', 'questionId', 'ms']);
const mask = (v: unknown): unknown => Array.isArray(v) ? v.map(mask) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, VAR.has(k) && (typeof x === 'string' || typeof x === 'number') ? '<var>' : mask(x)])) : v;
const record = (name: string, req: unknown, res: { status: number; body: unknown }) => kit.push({ name, request: mask(req), http: res.status, response: mask(res.body) });
// 1. ingress
{ const r = await send(new Request(URL, { method: 'GET', headers: { authorization: `Bearer ${JA}` } }));
  check(r.status === 405 && r.body.ingress === 'method_not_allowed' && depsCalls === 0, `${K} GET → 405 ingress, nessun accesso`, r.body);
  const off = await Hoff(web({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION })); const ob = await off.json();
  check(off.status === 503 && ob.errorCode === 'service_disabled' && ob.outcome === 'not_accepted' && ob.sessionId === null && valid(ob) && depsCalls === 0, `${K} flag OFF → 503 service_disabled (semantic-1.2) prima di JWT/store`, ob);
  for (const [label, tok] of [['assente', null], ['firma invalida', await jwt(A.uid, { secret: 'other-secret' })], ['scaduto', await jwt(A.uid, { exp: Math.floor(lab.now() / 1000) - 10 })], ['ruolo anon', await jwt(A.uid, { role: 'anon' })]] as const) {
    const r2 = await send(web({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION }, tok)); check(r2.status === 401 && r2.body.ingress === 'unauthorized' && depsCalls === 0, `${K} JWT ${label} → 401 ingress, nessun accesso`, r2.body); }
  const rc = await send(web({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION }, JC)); check(rc.status === 403 && rc.body.ingress === 'pilot_not_allowed' && depsCalls === 0, `${K} utente fuori pilota → 403 ingress, nessun accesso`, rc.body);
  const big = await send(web({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION, pad: 'x'.repeat(5000) })); check(big.status === 413 && depsCalls === 0, `${K} payload > limite → 413 ingress`, big.body);
  const mal = await send(new Request(URL, { method: 'POST', headers: { authorization: `Bearer ${JA}` }, body: '{not json' })); check(mal.status === 400 && mal.body.errorCode === 'invalid_request' && mal.body.sessionId === null && typeof mal.body.correlationId === 'string' && valid(mal.body) && catalogLoads === 0, `${K} JSON malformato → 400 invalid_request semantic-1.2, identità null, nessun catalogo`, mal.body); record('malformed_json', '{not json', mal);
  const old = await send(web({ operation: 'capabilities', contractVersion: 'semantic-1.1' })); check(old.status === 400 && old.body.errorCode === 'unsupported_contract', `${K} contractVersion 1.1 → unsupported_contract`); record('unsupported_contract_1.1', { operation: 'capabilities', contractVersion: 'semantic-1.1' }, old); }
// 2. identity from the token only; no catalog/settings before authorization
{ const spoof = await send(web({ operation: 'create_session', contractVersion: TRANSPORT_VERSION, callerUid: B.uid })); check(spoof.status === 400 && spoof.body.errorCode === 'invalid_request' && catalogLoads === 0, `${K} payload che tenta di scegliere l'identità → invalid_request (schema stretto)`, spoof.body);
  const other = await send(web({ operation: 'create_session', contractVersion: TRANSPORT_VERSION, targetAgentId: B.uid })); check(other.status === 403 && other.body.errorCode === 'forbidden_agent' && catalogLoads === 0 && settingsLoads === 0 && valid(other.body), `${K} A autorizzato tenta di operare sull'agente B → 403 forbidden_agent, nessun catalogo/settings`, other.body); record('forbidden_agent_other_user', { operation: 'create_session', contractVersion: TRANSPORT_VERSION, targetAgentId: '<var>' }, other);
  const cap = await send(web({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION })); check(cap.status === 200 && valid(cap.body) && JSON.stringify(cap.body.supportedVersions) === '["semantic-1.2"]', `${K} capabilities 1.2`); record('capabilities', { operation: 'capabilities', contractVersion: TRANSPORT_VERSION }, cap);
  const cs = await send(web({ operation: 'create_session', contractVersion: TRANSPORT_VERSION })); const sid = (cs.body.state as Record<string, string>).sessionId;
  check(cs.status === 201 && valid(cs.body) && catalogLoads === 0, `${K} create_session 201, nessun catalogo caricato`, cs.body); record('create_session', { operation: 'create_session', contractVersion: TRANSPORT_VERSION }, cs);
  const R1 = crypto.randomUUID(); const treq = { operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid, requestId: R1, expectedRevision: 0, message: 'Vai a Milano', client: { platform: 'web', appVersion: 'lab' } };
  const t1 = await send(web(treq)); check(t1.status === 200 && t1.body.gate === 'planned' && catalogLoads === 1 && settingsLoads === 1 && valid(t1.body), `${K} turno autorizzato → planned; catalogo/settings letti UNA volta dopo la claim (RLS utente in L2)`, t1.body); record('turn_planned', treq, t1);
  const bA = await send(web({ operation: 'get_state', contractVersion: TRANSPORT_VERSION, sessionId: sid }, JB)); check(bA.status === 403 && bA.body.errorCode === 'forbidden_session' && bA.body.sessionId === sid && valid(bA.body), `${K} B (in pilota) sulla sessione di A → 403 forbidden_session non enumerante`, bA.body); record('forbidden_session_other_user', { operation: 'get_state', contractVersion: TRANSPORT_VERSION, sessionId: '<var>' }, bA);
  // 3. parity: same requestId through the other adapter → byte-identical persisted body
  const t1m = await send(mobile({ ...treq, client: { platform: 'mobile', appVersion: 'lab' } }));
  check(t1m.status === 200 && t1m.text === t1.text, `${K} stesso requestId via adapter mobile (ordine chiavi/whitespace/header diversi) → body persistito byte-identico`, { w: t1.text.length, m: t1m.text.length });
  // independent requests web vs mobile: identical after masking variable fields
  const cs2 = await send(mobile({ operation: 'create_session', contractVersion: TRANSPORT_VERSION })); const sid2 = (cs2.body.state as Record<string, string>).sessionId;
  const t2 = await send(mobile({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid2, requestId: crypto.randomUUID(), expectedRevision: 0, message: 'Vai a Milano', client: { platform: 'mobile', appVersion: 'lab' } }));
  check(t2.status === 200 && JSON.stringify(mask(t2.body)) === JSON.stringify(mask(t1.body)) && t2.body.correlationId === undefined, `${K} richieste indipendenti web/mobile → identiche a meno dei campi variabili (id, timestamp, correlationId)`, { diff: JSON.stringify(mask(t2.body)).length });
  const e1 = await send(web({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid, requestId: crypto.randomUUID(), expectedRevision: 0, message: 'x', client: { platform: 'web', appVersion: 'lab' } }));
  const e2 = await send(mobile({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid2, requestId: crypto.randomUUID(), expectedRevision: 0, message: 'x', client: { platform: 'mobile', appVersion: 'lab' } }));
  check(e1.body.errorCode === 'revision_conflict' && e2.body.errorCode === 'revision_conflict' && e1.body.correlationId !== e2.body.correlationId && JSON.stringify(mask(e1.body)) === JSON.stringify(mask(e2.body)), `${K} errori committed web/mobile: correlationId distinti, resto identico`, e1.body); record('turn_revision_conflict', { operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: '<var>', requestId: '<var>', expectedRevision: 0, message: 'x', client: { platform: 'web', appVersion: 'lab' } }, e1);
  // 4. planner dependency failure → runtime recovery (never a fake 'no candidates' nor a verified plan)
  const sid3 = ((await send(web({ operation: 'create_session', contractVersion: TRANSPORT_VERSION }))).body.state as Record<string, string>).sessionId; const R3 = crypto.randomUUID();
  plannerOverride = { async plan() { throw new DependencyError('routing', 'MOCKED OSRM unreachable'); } };
  const req3 = { operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid3, requestId: R3, expectedRevision: 0, message: 'Vai a Milano', client: { platform: 'web', appVersion: 'lab' } };
  const f = await send(web(req3)); check(f.status === 503 && f.body.errorCode === 'dependency_unavailable' && f.body.outcome === 'recoverable' && f.body.plan === null && f.body.gate === null && f.body.retryableSameRequest === true && valid(f.body), `${K} routing/planner indisponibile → 503 dependency_unavailable recuperabile (non 'nessun candidato', nessun piano)`, f.body); record('turn_dependency_unavailable', req3, f);
  const gr = await send(web({ operation: 'get_request', contractVersion: TRANSPORT_VERSION, sessionId: sid3, requestId: R3 })); check((gr.body.receipt as Record<string, unknown>).status === 'pending', `${K} get_request → pending (nessun esito finto persistito)`);
  plannerOverride = null; await lab.expireLease(sid3, R3); const f2 = await send(mobile(req3));
  check(f2.status === 200 && f2.body.gate === 'planned' && (f2.body.plan as Record<string, unknown>).verification === 'estimated_routing' && f2.body.sessionRevision === 1, `${K} retry stesso requestId con dipendenza ripristinata → planned (routing stimato, mai dichiarato verificato)`, f2.body);
  plannerOverride = plannerMock('infeasible', 'area', 'MOCKED nessun cliente'); const sid4 = ((await send(web({ operation: 'create_session', contractVersion: TRANSPORT_VERSION }))).body.state as Record<string, string>).sessionId;
  const inf = await send(web({ ...req3, sessionId: sid4, requestId: crypto.randomUUID() })); check(inf.status === 200 && inf.body.gate === 'blocked' && (inf.body.openQuestions as unknown[]).length === 1, `${K} planner infeasible dichiarato dal planner → blocked con domanda (distinto dall'errore dipendenza)`, inf.body); record('turn_blocked_infeasible', { ...req3, sessionId: '<var>', requestId: '<var>' }, inf); plannerOverride = null; }
const out = Deno.env.get('U2D_KIT_OUT'); if (out) await Deno.writeTextFile(out, JSON.stringify({ contractVersion: TRANSPORT_VERSION, note: 'Kit semantic-1.2 generato dal lab (campi variabili mascherati <var>); NON certifica app reali', level: lab.kind, cases: kit }, null, 2));
done(`U2D HANDLER[${lab.kind}]`);
