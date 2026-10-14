// U2-d/2 lab server for the REAL-browser CORS check (cors_browser.py): the production handler + memory store + simulated deps, bound to 127.0.0.1.
// Env: LAB_PORT, LAB_ALLOWED_ORIGIN (one explicit origin), LAB_SECRET (synthetic). Prints a synthetic user JWT line `JWT <token>` and `REQ <method> <origin> <status>` per request.
import { A, deps, labConfig, makeLab } from '../u2c/harness.ts';
import { makeHttpHandler } from '../../../../supabase/functions/gptour-semantic-v2/handler.ts';
const lab = makeLab(labConfig()), SECRET = Deno.env.get('LAB_SECRET')!, PORT = Number(Deno.env.get('LAB_PORT')), ORIGIN = Deno.env.get('LAB_ALLOWED_ORIGIN')!;
if (!SECRET || !PORT || !ORIGIN) throw new Error('LAB_SECRET / LAB_PORT / LAB_ALLOWED_ORIGIN required');
const b64 = (s: string | Uint8Array) => btoa(typeof s === 'string' ? s : String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const now = Date.now; // real clock: browser-issued tokens must be valid "now"
const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify({ sub: A.uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(now() / 1000) + 600 }));
const pExp = b64(JSON.stringify({ sub: A.uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(now() / 1000) - 60 }));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sign = async (hh: string, pp: string) => b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${hh}.${pp}`))));
console.log(`JWT ${h}.${p}.${await sign(h, p)}`); console.log(`JWT_EXPIRED ${h}.${pExp}.${await sign(h, pExp)}`);
const H = makeHttpHandler({ enabled: true, allowedUids: new Set([A.uid]), allowedOrigins: new Set([ORIGIN]), userJwtSecret: SECRET, maxBodyBytes: 65536 }, () => deps(lab, { workingDays: [1, 2, 3, 4, 5] }), now);
Deno.serve({ port: PORT, hostname: '127.0.0.1', onListen: () => console.log(`LISTENING ${PORT}`) }, async req => { const r = await H(req); console.log(`REQ ${req.method} ${req.headers.get('origin') ?? '-'} ${r.status}`); return r; });
