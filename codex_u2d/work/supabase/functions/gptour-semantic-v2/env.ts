// U2-d: configuration. Flag OFF by default; pilot = explicit UIDs only; CORS = explicit origins only (none by default). Fail-fast on missing secrets (no defaults for credentials).
export interface V2Config { enabled: boolean; allowedUids: Set<string>; allowedOrigins: Set<string>; userJwtSecret: string; maxBodyBytes: number }
const list = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
/** Origin = scheme://host[:port], no path/query/fragment, no wildcard (`*` is never accepted: credentials travel in the Authorization header). */
export function parseOrigin(raw: string): string {
  let u: URL; try { u = new URL(raw); } catch { throw new Error(`GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS: origin non valida «${raw}»`); }
  if (!/^https?:$/.test(u.protocol) || u.pathname !== '/' || u.search || u.hash || u.username || u.password || raw.endsWith('/')) throw new Error(`GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS: origin non valida «${raw}» (attesa scheme://host[:port])`);
  return u.origin;
}
export function configFromEnv(get: (k: string) => string | undefined = k => Deno.env.get(k)): V2Config {
  const secret = get('GPTOUR_SEMANTIC_V2_JWT_SECRET'); if (!secret) throw new Error('GPTOUR_SEMANTIC_V2_JWT_SECRET missing');
  return { enabled: get('GPTOUR_SEMANTIC_V2_ENABLED') === 'true', allowedUids: new Set(list(get('GPTOUR_SEMANTIC_V2_ALLOWED_UIDS'))), allowedOrigins: new Set(list(get('GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS')).map(parseOrigin)), userJwtSecret: secret, maxBodyBytes: 64 * 1024 };
}
