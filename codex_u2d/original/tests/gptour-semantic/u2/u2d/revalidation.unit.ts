// U2-d/2: deterministic revalidation adapter (adapters/revalidation.ts) — unit + through the handler/runtime (turn.ts passes ctx.catalogHash).
// Proves: same catalog → ok; engine mismatch → engine_changed (409, state unchanged); catalog changed between context build and plan → context_changed (409);
// catalog unreadable at revalidation → dependency_unavailable (recoverable), never a silent ok.
import { A, CATALOG, check, deps, done, labConfig, makeLab } from '../u2c/harness.ts';
import { makeHttpHandler } from '../../../../supabase/functions/gptour-semantic-v2/handler.ts';
import { makeRevalidation } from '../../../../supabase/functions/gptour-semantic-v2/adapters/revalidation.ts';
import { canonicalJson, sha256Hex } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/canonical.ts';
import { DependencyError } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/ports.ts';
import type { ReferenceCatalog, SemanticState } from '../../../../supabase/functions/_shared/gptour-semantic/contract.ts';
import { TRANSPORT_VERSION } from '../../../../supabase/functions/_shared/gptour-semantic-transport/contract.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
const lab = makeLab(labConfig()); if (lab.kind !== 'memory') { console.log('revalidation: L1 only'); Deno.exit(0); }
const SECRET = 'lab-synthetic-secret-not-a-real-key', ENGINE = 'gptour-semantic-runtime/u2-c';
const b64 = (s: string | Uint8Array) => btoa(typeof s === 'string' ? s : String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify({ sub: A.uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(lab.now() / 1000) + 600 }));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const JA = `${h}.${p}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`))))}`;
const HASH = await sha256Hex(canonicalJson(CATALOG)), state = {} as SemanticState;
// 1. unit
{ const rv = makeRevalidation(A.uid, { async load() { return CATALOG; } });
  check(JSON.stringify(await rv.check({ state, acceptedAt: 'x', engineVersion: ENGINE, contextEngineVersion: ENGINE, catalogHash: HASH })) === '{"ok":true}', 'revalidation: stesso motore + stesso catalogo → ok');
  check(JSON.stringify(await rv.check({ state, acceptedAt: 'x', engineVersion: ENGINE, contextEngineVersion: 'other/engine', catalogHash: HASH })) === '{"ok":false,"code":"engine_changed"}', 'revalidation: motore diverso → engine_changed (prima di leggere il catalogo)');
  check(JSON.stringify(await rv.check({ state, acceptedAt: 'x', engineVersion: ENGINE, contextEngineVersion: ENGINE, catalogHash: 'deadbeef' })) === '{"ok":false,"code":"context_changed"}', 'revalidation: hash catalogo diverso → context_changed');
  check(JSON.stringify(await rv.check({ state, acceptedAt: 'x', engineVersion: ENGINE, contextEngineVersion: ENGINE })) === '{"ok":true}', 'revalidation: contesto senza hash → ok (nulla da confrontare, dichiarato)');
  const reordered: ReferenceCatalog = JSON.parse(JSON.stringify({ projects: [], stops: [], events: [], provinces: [...CATALOG.provinces].reverse(), localities: CATALOG.localities.map(l => ({ provincia: l.provincia, name: l.name })) }));
  const rv2 = makeRevalidation(A.uid, { async load() { return reordered; } });
  check(JSON.stringify(await rv2.check({ state, acceptedAt: 'x', engineVersion: ENGINE, contextEngineVersion: ENGINE, catalogHash: HASH })) === '{"ok":false,"code":"context_changed"}', 'revalidation: ordine delle righe diverso = catalogo diverso (hash canonico sulle chiavi, non sull\'ordine degli array)');
  const rv3 = makeRevalidation(A.uid, { async load() { throw new DependencyError('catalog', 'http 503'); } });
  let err: unknown = null; try { await rv3.check({ state, acceptedAt: 'x', engineVersion: ENGINE, contextEngineVersion: ENGINE, catalogHash: HASH }); } catch (e) { err = e; }
  check(err instanceof DependencyError && err.dependency === 'revalidation', 'revalidation: catalogo illeggibile → DependencyError(revalidation), mai ok silenzioso'); }
// 2. through the runtime: the catalog port is swapped between context build (first load) and revalidation (second load)
let loads = 0, swapAfterFirst: ReferenceCatalog | null = null, failAfterFirst = false; let engine = ENGINE;
const catalog = { async load() { loads++; if (loads > 1 && failAfterFirst) throw new DependencyError('catalog', 'http 503 (simulato)'); return loads > 1 && swapAfterFirst ? swapAfterFirst : CATALOG; } };
const H = makeHttpHandler({ enabled: true, allowedUids: new Set([A.uid]), allowedOrigins: new Set<string>(), userJwtSecret: SECRET, maxBodyBytes: 65536 }, caller => { const d = deps(lab, { workingDays: [1, 2, 3, 4, 5] }); d.catalog = catalog; d.revalidation = makeRevalidation(caller.uid, catalog); d.engineVersion = engine; return d; }, lab.now);
const post = async (body: unknown) => { const r = await H(new Request('http://lab/v2', { method: 'POST', headers: { authorization: `Bearer ${JA}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() as Record<string, unknown> }; };
const newSession = async () => ((await post({ operation: 'create_session', contractVersion: TRANSPORT_VERSION })).body.state as Record<string, string>).sessionId;
const turn = (sessionId: string, requestId: string, rev = 0) => post({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId, requestId, expectedRevision: rev, message: 'Vai a Milano', client: { platform: 'web', appVersion: 'lab' } });
{ const sid = await newSession(); loads = 0; const r = await turn(sid, crypto.randomUUID());
  check(r.status === 200 && r.body.gate === 'planned' && loads === 2 && validateTransportResponse(r.body).ok, 'runtime: catalogo invariato → planned; catalogo letto 2 volte (contesto + rivalidazione)', { s: r.status, loads, e: r.body.errorCode });
  const sid2 = await newSession(); loads = 0; swapAfterFirst = { ...CATALOG, localities: [...CATALOG.localities, { name: 'Lodi', provincia: 'LO' }] };
  const r2 = await turn(sid2, crypto.randomUUID());
  check(r2.status === 409 && r2.body.errorCode === 'context_changed' && r2.body.plan === null && validateTransportResponse(r2.body).ok, 'runtime: catalogo cambiato fra contesto e piano → 409 context_changed, nessun piano', r2.body);
  const st = await post({ operation: 'get_state', contractVersion: TRANSPORT_VERSION, sessionId: sid2 }); check((st.body.state as Record<string, unknown>).sessionRevision === 0, 'runtime: stato invariato dopo context_changed'); swapAfterFirst = null;
  const sid3 = await newSession(); loads = 0; failAfterFirst = true; const rid3 = crypto.randomUUID(); const r3 = await turn(sid3, rid3);
  check(r3.status === 503 && r3.body.errorCode === 'dependency_unavailable' && r3.body.outcome === 'recoverable', 'runtime: catalogo illeggibile alla rivalidazione → 503 dependency_unavailable recuperabile', r3.body);
  failAfterFirst = false; await lab.expireLease(sid3, rid3); loads = 0; const r3b = await turn(sid3, rid3);
  check(r3b.status === 200 && r3b.body.gate === 'planned', 'runtime: retry stesso requestId con catalogo leggibile → planned', r3b.body);
  // engine_changed: the context recovered after a takeover carries the OLD engine version; the new worker runs a newer engine.
  const sid4 = await newSession(); const rid4 = crypto.randomUUID(); const d4 = deps(lab, { workingDays: [1, 2, 3, 4, 5] }); d4.catalog = catalog; d4.crash = (pt: string) => { if (pt === 'C3') throw Object.assign(new Error('crash'), { name: 'WorkerCrash' }); };
  const { handle } = await import('../../../../supabase/functions/_shared/gptour-semantic-runtime/turn.ts');
  try { await handle({ operation: 'turn', contractVersion: TRANSPORT_VERSION, sessionId: sid4, requestId: rid4, expectedRevision: 0, message: 'Vai a Milano', client: { platform: 'web', appVersion: 'lab' } }, A, d4); } catch { /* worker died after store_context */ }
  await lab.expireLease(sid4, rid4); engine = 'gptour-semantic-runtime/u2-c+1'; const r4 = await turn(sid4, rid4);
  check(r4.status === 409 && r4.body.errorCode === 'engine_changed', 'runtime: takeover da motore diverso (contesto persistito dal vecchio) → 409 engine_changed', r4.body); engine = ENGINE; }
done('U2D REVALIDATION[memory]');
