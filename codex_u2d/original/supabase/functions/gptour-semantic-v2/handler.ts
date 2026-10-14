// U2-d: HTTP ingress for the U2-c runtime. Order: origin (CORS) → preflight → method → flag → JWT → pilot → size → JSON → handle(). Nothing touches store/catalog/settings before the pilot check.
// Ingress failures (origin/method/auth/pilot/size) are plain HTTP JSON {ingress, correlationId}: they are NOT semantic-1.2 bodies and invent no contract codes.
// Everything after the JSON stage is a semantic-1.2 body produced by handle() (service_disabled and invalid_request are contract codes).
// CORS: only origins explicitly listed in cfg.allowedOrigins get Access-Control-* headers (on success AND error responses); requests carrying any other Origin are refused (403) before auth.
// Requests without an Origin header (native mobile, server-to-server) are not CORS requests and get no CORS headers.
import { TRANSPORT_VERSION } from '../_shared/gptour-semantic-transport/contract.ts';
import { ERROR_POLICIES } from '../_shared/gptour-semantic-transport/errors.ts';
import { errorTurn } from '../_shared/gptour-semantic-runtime/responses.ts';
import { handle } from '../_shared/gptour-semantic-runtime/turn.ts';
import type { TurnDeps } from '../_shared/gptour-semantic-runtime/ports.ts';
import type { TrustedCaller } from '../_shared/gptour-semantic-runtime/store-port.ts';
import { verifyUserJwt } from './auth.ts';
import type { V2Config } from './env.ts';
export type DepsFactory = (caller: TrustedCaller, userJwt: string) => TurnDeps;
export interface HandlerDiag { stage: 'origin' | 'preflight' | 'method' | 'disabled' | 'auth' | 'pilot' | 'size' | 'json' | 'handled'; uid: string | null }
export const CORS_ALLOW_METHODS = 'POST, OPTIONS', CORS_ALLOW_HEADERS = 'authorization, content-type', CORS_MAX_AGE = '600';
const corsHeaders = (origin: string): Record<string, string> => ({ 'access-control-allow-origin': origin, 'vary': 'origin' });
export function makeHttpHandler(cfg: V2Config, depsFor: DepsFactory, now: () => number = Date.now, diag: HandlerDiag[] = []) {
  return async (req: Request): Promise<Response> => {
    const d: HandlerDiag = { stage: 'origin', uid: null }; diag.push(d);
    const origin = req.headers.get('origin');
    const cors = origin !== null && cfg.allowedOrigins.has(origin) ? corsHeaders(origin) : {};
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors } });
    const ingress = (status: number, ingress: string) => json(status, { ingress, correlationId: crypto.randomUUID() });
    if (origin !== null && !cfg.allowedOrigins.has(origin)) return ingress(403, 'origin_not_allowed');
    if (req.method === 'OPTIONS') {
      d.stage = 'preflight';
      if (origin === null) return ingress(405, 'method_not_allowed'); // not a CORS preflight
      return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': CORS_ALLOW_METHODS, 'access-control-allow-headers': CORS_ALLOW_HEADERS, 'access-control-max-age': CORS_MAX_AGE, 'cache-control': 'no-store' } });
    }
    d.stage = 'method';
    if (req.method !== 'POST') return ingress(405, 'method_not_allowed');
    if (!cfg.enabled) { d.stage = 'disabled'; const p = ERROR_POLICIES.service_disabled; return json(p.httpStatus, errorTurn({ sessionId: null, requestId: null, engineVersion: 'disabled' }, 'service_disabled', null)); }
    d.stage = 'auth';
    const auth = req.headers.get('authorization') ?? ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const user = await verifyUserJwt(token, cfg.userJwtSecret, now());
    if (!user) return ingress(401, 'unauthorized');
    d.stage = 'pilot'; d.uid = user.uid;
    if (!cfg.allowedUids.has(user.uid)) return ingress(403, 'pilot_not_allowed');
    d.stage = 'size';
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > cfg.maxBodyBytes) return ingress(413, 'payload_too_large');
    d.stage = 'json';
    let input: unknown; try { input = JSON.parse(raw); } catch { input = Symbol('malformed'); } // malformed JSON → handle() yields semantic invalid_request (identity null)
    const caller: TrustedCaller = { uid: user.uid }; // identity from the verified token ONLY
    const deps = depsFor(caller, token!);
    d.stage = 'handled';
    const r = await handle(input, caller, deps);
    return json(r.http, r.body);
  };
}
export const V2_CONTRACT = TRANSPORT_VERSION;
