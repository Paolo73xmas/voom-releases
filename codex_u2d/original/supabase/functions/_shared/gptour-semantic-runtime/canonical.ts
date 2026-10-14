// Canonical payload identity: sorted keys, `client` excluded (platform never influences hash/prompt/rules). SHA-256 hex (64).
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
}
export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function payloadHash(turn: Record<string, unknown>): Promise<string> {
  const { client: _client, ...rest } = turn; void _client;
  return sha256Hex(canonicalJson(rest));
}
