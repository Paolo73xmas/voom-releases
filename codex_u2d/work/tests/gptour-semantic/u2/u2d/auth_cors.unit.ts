// U2-d/2: auth.ts hardening (malformed Base64URL / non-object JSON / alg) → 401 with ZERO dependency access; CORS on explicit origins (preflight, success and error responses).
// L1 only (memory store): these behaviours are decided before any store/catalog/settings access.
import { A, check, deps, done, labConfig, makeLab } from '../u2c/harness.ts';
import { CORS_ALLOW_HEADERS, CORS_ALLOW_METHODS, makeHttpHandler, type HandlerDiag } from '../../../../supabase/functions/gptour-semantic-v2/handler.ts';
import { verifyUserJwt } from '../../../../supabase/functions/gptour-semantic-v2/auth.ts';
import { configFromEnv, parseOrigin } from '../../../../supabase/functions/gptour-semantic-v2/env.ts';
import { TRANSPORT_VERSION } from '../../../../supabase/functions/_shared/gptour-semantic-transport/contract.ts';
import { validateTransportResponse } from '../../../../supabase/functions/_shared/gptour-semantic-transport/response-validation.ts';
const lab = makeLab(labConfig()), SECRET = 'lab-synthetic-secret-not-a-real-key';
const b64 = (s: string | Uint8Array) => btoa(typeof s === 'string' ? s : String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sign(h: string, p: string, secret = SECRET) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`)))); }
const H = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), P = b64(JSON.stringify({ sub: A.uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(lab.now() / 1000) + 600 }));
const GOOD = `${H}.${P}.${await sign(H, P)}`;
// 1. verifyUserJwt: structural defects never throw, never reach crypto
{ const cases: Array<[string, string]> = [
    ['firma Base64URL malformata (!!!)', `${H}.${P}.!!!`], ['firma con caratteri fuori alfabeto (+/=)', `${H}.${P}.ab+/cd==`], ['firma lunghezza ≡ 1 mod 4', `${H}.${P}.abcde`],
    ['firma vuota', `${H}.${P}.`], ['firma di lunghezza errata (non 32 byte)', `${H}.${P}.${b64('short')}`], ['header Base64URL malformato', `!!!.${P}.${await sign(H, P)}`],
    ['header JSON non valido', `${b64('{not json')}.${P}.x`], ['header JSON non oggetto (array)', `${b64('[1,2]')}.${P}.x`], ['claims JSON non oggetto (stringa)', `${H}.${b64('"abc"')}.x`],
    ['claims JSON null', `${H}.${b64('null')}.x`], ['claims non JSON (binario)', `${H}.${b64(new Uint8Array([0xff, 0xfe, 0x00, 0x01]))}.x`], ['alg none', `${b64(JSON.stringify({ alg: 'none' }))}.${P}.`],
    ['alg RS256', `${b64(JSON.stringify({ alg: 'RS256' }))}.${P}.${await sign(H, P)}`], ['due segmenti', `${H}.${P}`], ['quattro segmenti', `${H}.${P}.${await sign(H, P)}.extra`], ['token vuoto', ''],
    ['sub non UUID', (async () => { const p = b64(JSON.stringify({ sub: 'not-a-uuid', role: 'authenticated', exp: Math.floor(lab.now() / 1000) + 600 })); return `${H}.${p}.${await sign(H, p)}`; })() as unknown as string],
    ['exp non numerico', (async () => { const p = b64(JSON.stringify({ sub: A.uid, role: 'authenticated', exp: '9999999999' })); return `${H}.${p}.${await sign(H, p)}`; })() as unknown as string],
  ];
  for (const [label, tok] of cases) {
    const t = await (tok as unknown as Promise<string> | string); let out: unknown = 'THROWN'; try { out = await verifyUserJwt(t, SECRET, lab.now()); } catch (e) { out = `THROWN ${(e as Error).name}`; }
    check(out === null, `auth: ${label} → null (nessuna eccezione)`, out);
  }
  check((await verifyUserJwt(GOOD, SECRET, lab.now()))?.uid === A.uid, 'auth: token valido → uid dal token');
  check(await verifyUserJwt(GOOD, 'other-secret', lab.now()) === null, 'auth: token valido con segreto diverso → null'); }
// 2. handler: malformed tokens → 401 ingress BEFORE depsFor (no store/catalog/settings), with CORS headers when the origin is allowed
const ALLOWED = 'http://lab-web.local:3000', OTHER = 'http://evil.example';
let depsCalls = 0; const diag: HandlerDiag[] = [];
const cfg = { enabled: true, allowedUids: new Set([A.uid]), allowedOrigins: new Set([ALLOWED]), userJwtSecret: SECRET, maxBodyBytes: 4096 };
const H1 = makeHttpHandler(cfg, () => { depsCalls++; return deps(lab, { workingDays: [1, 2, 3, 4, 5] }); }, lab.now, diag);
const URL = 'http://lab/gptour-semantic-v2', CAP = JSON.stringify({ operation: 'capabilities', contractVersion: TRANSPORT_VERSION });
const req = (o: { method?: string; origin?: string | null; token?: string | null; body?: string | null; acrm?: string }) => new Request(URL, { method: o.method ?? 'POST', headers: { ...(o.origin ? { origin: o.origin } : {}), ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.body !== null ? { 'content-type': 'application/json' } : {}), ...(o.acrm ? { 'access-control-request-method': o.acrm, 'access-control-request-headers': 'authorization,content-type' } : {}) }, body: o.method === 'GET' || o.method === 'OPTIONS' ? undefined : o.body ?? CAP });
{ for (const [label, tok] of [['firma !!!', `${H}.${P}.!!!`], ['header non JSON', `${b64('{x')}.${P}.abc`], ['claims array', `${H}.${b64('[]')}.abc`]] as const) {
    const r = await H1(req({ token: tok, origin: ALLOWED })); const b = await r.json();
    check(r.status === 401 && b.ingress === 'unauthorized' && depsCalls === 0 && r.headers.get('access-control-allow-origin') === ALLOWED && r.headers.get('vary') === 'origin', `handler: JWT ${label} → 401 ingress, nessun accesso, CORS su errore (origin ammessa)`, { s: r.status, b, acao: r.headers.get('access-control-allow-origin') }); } }
// 3. CORS
{ const pre = await H1(req({ method: 'OPTIONS', origin: ALLOWED, acrm: 'POST' }));
  check(pre.status === 204 && pre.headers.get('access-control-allow-origin') === ALLOWED && pre.headers.get('access-control-allow-methods') === CORS_ALLOW_METHODS && pre.headers.get('access-control-allow-headers') === CORS_ALLOW_HEADERS && pre.headers.get('access-control-max-age') === '600' && pre.headers.get('vary') === 'origin' && depsCalls === 0, 'CORS: preflight OPTIONS da origin ammessa → 204 + allow-origin/methods/headers/max-age, nessun accesso', Object.fromEntries(pre.headers));
  check(!pre.headers.get('access-control-allow-origin')?.includes('*'), 'CORS: mai wildcard * (Authorization in gioco)');
  const preBad = await H1(req({ method: 'OPTIONS', origin: OTHER, acrm: 'POST' })); const pb = await preBad.json();
  check(preBad.status === 403 && pb.ingress === 'origin_not_allowed' && preBad.headers.get('access-control-allow-origin') === null && depsCalls === 0, 'CORS: preflight da origin NON ammessa → 403 ingress senza header CORS', pb);
  const preNo = await H1(req({ method: 'OPTIONS', origin: null })); check(preNo.status === 405 && (await preNo.json()).ingress === 'method_not_allowed', 'CORS: OPTIONS senza Origin non è un preflight → 405');
  const okR = await H1(req({ token: GOOD, origin: ALLOWED })); const ob = await okR.json();
  check(okR.status === 200 && validateTransportResponse(ob).ok && okR.headers.get('access-control-allow-origin') === ALLOWED && okR.headers.get('vary') === 'origin', 'CORS: risposta di successo (capabilities 200) con allow-origin + vary', { s: okR.status, acao: okR.headers.get('access-control-allow-origin') });
  const errR = await H1(req({ token: GOOD, origin: ALLOWED, body: '{not json' })); const eb = await errR.json();
  check(errR.status === 400 && eb.errorCode === 'invalid_request' && errR.headers.get('access-control-allow-origin') === ALLOWED, 'CORS: errore contrattuale semantic-1.2 (400 invalid_request) con header CORS', eb);
  const postBad = await H1(req({ token: GOOD, origin: OTHER })); const pbb = await postBad.json(); const callsBefore = depsCalls;
  check(postBad.status === 403 && pbb.ingress === 'origin_not_allowed' && postBad.headers.get('access-control-allow-origin') === null && depsCalls === callsBefore, 'CORS: POST con JWT valido ma origin NON ammessa → 403 prima dell\'autenticazione, nessun accesso', pbb);
  const noOrigin = await H1(req({ token: GOOD })); check(noOrigin.status === 200 && noOrigin.headers.get('access-control-allow-origin') === null, 'CORS: richiesta senza Origin (nativa) → 200 senza header CORS');
  const caseOrigin = await H1(req({ token: GOOD, origin: 'http://LAB-WEB.local:3000' })); check(caseOrigin.status === 403, 'CORS: confronto Origin letterale (nessuna normalizzazione case-insensitive)');
  const H0 = makeHttpHandler({ ...cfg, allowedOrigins: new Set() }, () => deps(lab), lab.now); const none = await H0(req({ method: 'OPTIONS', origin: ALLOWED, acrm: 'POST' }));
  check(none.status === 403 && (await none.json()).ingress === 'origin_not_allowed', 'CORS: lista vuota (default) → nessuna origin ammessa');
  const Hoff = makeHttpHandler({ ...cfg, enabled: false }, () => deps(lab), lab.now); const off = await Hoff(req({ origin: ALLOWED })); const offb = await off.json();
  check(off.status === 503 && offb.errorCode === 'service_disabled' && off.headers.get('access-control-allow-origin') === ALLOWED, 'CORS: flag OFF → 503 service_disabled con header CORS', offb); }
// 4. env parsing of origins
{ check(parseOrigin('https://app.example.com') === 'https://app.example.com' && parseOrigin('http://127.0.0.1:4173') === 'http://127.0.0.1:4173', 'env: origin valide normalizzate');
  for (const bad of ['*', 'https://app.example.com/', 'https://app.example.com/path', 'app.example.com', 'ftp://x', 'https://u:p@x.y']) { let threw = false; try { parseOrigin(bad); } catch { threw = true; } check(threw, `env: origin «${bad}» rifiutata (fail-fast)`); }
  const c = configFromEnv(k => ({ GPTOUR_SEMANTIC_V2_JWT_SECRET: 'lab-synthetic', GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS: ' https://a.example , http://localhost:5173 ' } as Record<string, string>)[k]);
  check(c.enabled === false && c.allowedUids.size === 0 && [...c.allowedOrigins].join(',') === 'https://a.example,http://localhost:5173', 'env: default enabled=false, pilot vuoto, origin dalla lista'); }
done('U2D AUTH+CORS[memory]');
