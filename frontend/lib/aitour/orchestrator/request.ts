import { CONTRACT_VERSION, type JsonValue, type RequestEnvelope, type Revision } from './contract';
import { OrchestratorError } from './errors';

export function validRevision(value: unknown): value is Revision {
  return (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (typeof value === 'string' && value.length > 0 && value.length < 200);
}
const authFields = /^(?:role|roles|permissions|is_admin|isAdmin|access_token|refresh_token|authorization|service_role|api_key)$/i;
export function jsonSafe(value: unknown, depth = 0): value is JsonValue {
  if (depth > 30) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(v => jsonSafe(v, depth + 1));
  return typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
    && Object.entries(value).every(([k, v]) => !authFields.test(k) && jsonSafe(v, depth + 1));
}
/** Whitelist envelope. Identity comes exclusively from the Supabase session, not caller roles. */
export function buildRequest(input: RequestEnvelope): RequestEnvelope {
  const bad = () => { throw new OrchestratorError('INVALID_REQUEST'); };
  if (input.contractVersion !== CONTRACT_VERSION || typeof input.sessionId !== 'string' || !input.sessionId.trim()
    || typeof input.requestId !== 'string' || !input.requestId.trim()) bad();
  if ((input.message !== undefined) === (input.action !== undefined)) bad();
  if (input.message !== undefined && (typeof input.message !== 'string' || !input.message.trim())) bad();
  if (input.action !== undefined && (input.action === null || !jsonSafe(input.action))) bad();
  if (input.expectedRevision !== undefined && !validRevision(input.expectedRevision)) bad();
  if (input.targetAgentId !== undefined && (typeof input.targetAgentId !== 'string' || !input.targetAgentId.trim())) bad();
  for (const value of [input.departure, input.gps]) if (value !== undefined && (value === null || !jsonSafe(value))) bad();
  const out: RequestEnvelope = { contractVersion: CONTRACT_VERSION, sessionId: input.sessionId, requestId: input.requestId };
  for (const key of ['expectedRevision', 'message', 'action', 'targetAgentId', 'departure', 'gps'] as const)
    if (input[key] !== undefined) Object.assign(out, { [key]: input[key] });
  return JSON.parse(JSON.stringify(out)) as RequestEnvelope;
}