// U2-d: user JWT verification (HS256, WebCrypto). The trusted identity comes ONLY from the verified token, never from the payload.
// Every structural defect (segments, Base64URL alphabet/padding, non-object JSON header/claims, alg) is rejected BEFORE any crypto or dependency access.
export interface VerifiedUser { uid: string; exp: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const b64url = (s: string): Uint8Array<ArrayBuffer> | null => {
  if (!B64URL.test(s) || s.length % 4 === 1) return null;
  try { return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0)); } catch { return null; }
};
const jsonObject = (bytes: Uint8Array | null): Record<string, unknown> | null => {
  if (!bytes) return null;
  try { const v: unknown = JSON.parse(new TextDecoder().decode(bytes)); return v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null; } catch { return null; }
};
export async function verifyUserJwt(token: string | null, secret: string, nowMs: number): Promise<VerifiedUser | null> {
  if (!token) return null;
  const parts = token.split('.'); if (parts.length !== 3) return null;
  const header = jsonObject(b64url(parts[0])), claims = jsonObject(b64url(parts[1])), sig = b64url(parts[2]);
  if (!header || !claims || !sig || sig.byteLength !== 32) return null;
  if (header.alg !== 'HS256') return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;
  if (claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !UUID.test(claims.sub)) return null;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= nowMs) return null;
  return { uid: claims.sub, exp: claims.exp };
}
