// U2-d/2: PlannerPort over the SHARED planner core (D3(a)) through the HTTP handler — same code path as v7, CRM/routing SIMULATED (FakeCrm/FakeRouting).
// Proves: real plan with verification=estimated_routing (never 'verified' with simulated routing), 'no candidates' → infeasible on 'area' (not a dependency error),
// routing fault → dependency_unavailable (recoverable, same requestId), settings fault → dependency_unavailable, mapping of every v7 outcome kind.
import { A, check, deps, done, labConfig, makeLab } from '../u2c/harness.ts';
import { makeHttpHandler } from '../../../../supabase/functions/gptour-semantic-v2/handler.ts';
import { makeCorePlanner, mapOutcome } from '../../../../supabase/functions/gptour-semantic-v2/adapters/planner-core.ts';
import { FakeCrm, FakeRouting, synthData } from '../../../../supabase/functions/_shared/gptour-orchestrator/adapters/memory.ts';
import { makeOp } from '../../../../supabase/functions/_shared/gptour-semantic/interpreter.ts';
import type { ReferenceCatalog } from '../../../../supabase/functions/_shared/gptour-semantic/contract.ts';
import { DependencyError } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/ports.ts';
import { TRANSPORT_VERSION } from '../../../../supabase/functions/_shared/gptour-semantic-transport/contract.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
import type { PlannerOutcome } from '../../../../supabase/functions/_shared/gptour-planner-core/planner.ts';
const lab = makeLab(labConfig()); if (lab.kind !== 'memory') { console.log('planner_core: L1 only'); Deno.exit(0); }
const SECRET = 'lab-synthetic-secret-not-a-real-key';
const b64 = (s: string | Uint8Array) => btoa(typeof s === 'string' ? s : String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify({ sub: A.uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(lab.now() / 1000) + 600 }));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const JA = `${h}.${p}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`))))}`;
const TODAY = '2026-10-15', TOMORROW = '2026-10-16'; // lab clock: 2026-10-15 23:59 Europe/Rome (Thu) → tomorrow Friday = working day
const CAT: ReferenceCatalog = { localities: [{ name: 'Rozzano', provincia: 'MI' }, { name: 'Opera', provincia: 'MI' }, { name: 'Milano', provincia: 'MI' }], provinces: [{ sigla: 'MI', nome: 'Milano' }], events: [], stops: [], projects: [] };
let crm = new FakeCrm(synthData(TODAY)), routing = new FakeRouting({ verified: false });
const ops = (loc: string, withDate = true) => [makeOp({ op: 'add_locality', locality: loc, provincia: null, evidence: loc }), ...(withDate ? [makeOp({ op: 'set', field: 'dates', dates: [TOMORROW], evidence: 'domani' })] : [])];
let script: ReturnType<typeof ops> = ops('Rozzano');
const cfg = { enabled: true, allowedUids: new Set([A.uid]), allowedOrigins: new Set<string>(), userJwtSecret: SECRET, maxBodyBytes: 65536 };
const H = makeHttpHandler(cfg, caller => { const d = deps(lab, { workingDays: [1, 2, 3, 4, 5], llmSteps: [{ kind: 'ok', ops: script }] }); d.catalog = { async load() { return CAT; } }; d.planner = makeCorePlanner(caller.uid, { crm, routing, newId: () => crypto.randomUUID() }) as typeof d.planner; return d; }, lab.now);
const URL = 'http://lab/gptour-semantic-v2';
const post = async (body: unknown) => { const r = await H(new Request(URL, { method: 'POST', headers: { authorization: `Bearer ${JA}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })); const t = await r.text(); return { status: r.status, text: t, body: JSON.parse(t) as Record<string, unknown> }; };
const newSession = async () => ((await post({ operation: 'create_session', contractVersion: TRANSPORT_VERSION })).body.state as Record<string, string>).sessionId;
const turn = (sessionId: string, requestId: string, message: string, expectedRevision = 0) => post({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId, requestId, expectedRevision, message, client: { platform: 'web', appVersion: 'lab' } });
// 1. real plan through the shared core, simulated routing → estimated_routing, never 'verified'
{ const sid = await newSession(); const r = await turn(sid, crypto.randomUUID(), 'domani a Rozzano i clienti');
  const plan = r.body.plan as Record<string, unknown> | null; const stops = (plan?.stops as unknown[]) ?? [];
  check(r.status === 200 && r.body.gate === 'planned' && validateTransportResponse(r.body).ok && plan !== null, 'core planner: turno → planned con piano reale (semantic-1.2 valido)', r.body);
  check(plan?.verification === 'estimated_routing' && plan?.date === TOMORROW && stops.length > 0, 'core planner: piano del 16/10 con tappe, verification=estimated_routing (routing simulato, mai «verified»)', { v: plan?.verification, n: stops.length, d: plan?.date, e: plan?.engineVersion });
  check((plan?.selectionReasons as Record<string, unknown[]>)?.selected?.length === stops.length && Array.isArray(plan?.warnings), 'core planner: selectionReasons/warnings v7 presenti nel piano U2', plan?.selectionReasons);
  const dq = r.body.dataQuality as Record<string, unknown>; check(dq?.routingSource === 'estimate' && dq?.candidatesComplete === true, 'core planner: dataQuality dal core (routingSource=estimate, candidati completi)', dq);
  check(crm.queries.some(q => q.startsWith('candidates:')) && crm.queries.includes('territory') && crm.queries.includes('settings') && routing.calls === 1, 'core planner: letture CRM simulate (settings/territory/candidates/agenda) e UNA matrice routing', { q: crm.queries, rc: routing.calls });
  const again = await turn(sid, (r.body.requestId as string), 'domani a Rozzano i clienti'); check(again.text === r.text, 'core planner: replay stesso requestId → body byte-identico (nessuna seconda pianificazione)', { rc: routing.calls }); }
// 2. no candidates in the area → infeasible on 'area' (blocked with question), NOT a dependency error, NOT a plan
{ const sid = await newSession(); script = ops('Milano'); const r = await turn(sid, crypto.randomUUID(), 'domani a Milano i clienti');
  const q = (r.body.openQuestions as Array<Record<string, unknown>>) ?? [];
  check(r.status === 200 && r.body.gate === 'blocked' && r.body.plan === null && q.length === 1 && JSON.stringify(r.body.notApplied).includes('"criterion":"area"'), 'core planner: nessun candidato a Milano → blocked, domanda sul criterio area (nessun piano, nessun errore dipendenza)', r.body); }
// 3. routing fault → dependency_unavailable recoverable (same requestId), then recovery
{ const sid = await newSession(); script = ops('Rozzano'); routing.failNext = true; const rid = crypto.randomUUID();
  const f = await turn(sid, rid, 'domani a Rozzano i clienti');
  check(f.status === 503 && f.body.errorCode === 'dependency_unavailable' && f.body.outcome === 'recoverable' && f.body.plan === null && f.body.retryableSameRequest === true, 'core planner: matrice OSRM simulata in errore → 503 dependency_unavailable recuperabile (routing_unavailable v7 mappato, nessun piano)', f.body);
  await lab.expireLease(sid, rid); const ok = await turn(sid, rid, 'domani a Rozzano i clienti');
  check(ok.status === 200 && ok.body.gate === 'planned' && (ok.body.plan as Record<string, unknown>).verification === 'estimated_routing', 'core planner: retry stesso requestId con routing ripristinato → planned (stimato)', ok.body); }
// 4. settings fault → dependency_unavailable ('settings'), nothing else consulted
{ const sid = await newSession(); const saved = crm; crm = new FakeCrm(synthData(TODAY)); crm.loadSettings = async () => { throw new Error('permission denied (simulato)'); };
  const r = await turn(sid, crypto.randomUUID(), 'domani a Rozzano i clienti');
  check(r.status === 503 && r.body.errorCode === 'dependency_unavailable' && !crm.queries.includes('territory'), 'core planner: impostazioni agente non leggibili → dependency_unavailable, nessuna lettura successiva', { b: r.body, q: crm.queries }); crm = saved; }
// 5. missing date from the projection → infeasible on 'dates' (deterministic: the field that is missing), without touching CRM
{ const sid = await newSession(); script = ops('Rozzano', false); const before = crm.queries.length; const r = await turn(sid, crypto.randomUUID(), 'a Rozzano i clienti');
  check(r.body.gate === 'blocked' && JSON.stringify(r.body.notApplied).includes('"criterion":"dates"') && crm.queries.length === before, 'core planner: proiezione senza data → blocked su criterio dates, nessuna lettura CRM', r.body); }
// 6. mapOutcome: every v7 outcome kind
{ const dq = { candidatesComplete: true, poolTruncated: false, purchasesVerified: true, registryVerified: true, routingSource: 'none' as const, notes: [] };
  const thrown = (o: PlannerOutcome) => { try { mapOutcome(o); return null; } catch (e) { return e as DependencyError; } };
  const t1 = thrown({ kind: 'blocked', errorCode: 'territory_unavailable', message: 'm' }); check(t1 instanceof DependencyError && t1.dependency === 'catalog', 'mapOutcome: blocked territory → DependencyError(catalog)');
  const t2 = thrown({ kind: 'failed', errorCode: 'routing_unavailable', message: 'm', dataQuality: dq }); check(t2 instanceof DependencyError && t2.dependency === 'routing', 'mapOutcome: failed routing → DependencyError(routing)');
  const i1 = mapOutcome({ kind: 'infeasible', message: 'm', conflicts: ['nessun candidato idoneo'], dataQuality: dq }); check(i1.kind === 'infeasible' && i1.criterion === 'area', 'mapOutcome: nessun candidato → area');
  const i2 = mapOutcome({ kind: 'infeasible', message: 'm', conflicts: ['follow-up fuori dalle date del giro: X'], dataQuality: dq }); check(i2.kind === 'infeasible' && i2.criterion === 'dates', 'mapOutcome: follow-up fuori date → dates');
  const i3 = mapOutcome({ kind: 'infeasible', message: 'm', conflicts: ['obbligatoria non idonea: X'], dataQuality: dq }); check(i3.kind === 'infeasible' && i3.criterion === 'other', 'mapOutcome: obbligatoria non idonea → other (nessuna attribuzione arbitraria)');
  const a1 = mapOutcome({ kind: 'ask', question: { id: 'infeasible', kind: 'infeasible', text: 'non entra', options: [] }, payload: null, conflicts: [] }); check(a1.kind === 'infeasible' && a1.criterion === 'time_window', 'mapOutcome: domanda infeasible v7 (orario) → time_window');
  const a2 = mapOutcome({ kind: 'ask', question: { id: 'fu', kind: 'follow_ups', text: 'agenda', options: [] }, payload: null, conflicts: [] }); check(a2.kind === 'infeasible' && a2.criterion === 'other' && a2.reason.includes('non supportate'), 'mapOutcome: domanda agenda v7 → other con limite dichiarato'); }
done('U2D PLANNER-CORE[memory]');
