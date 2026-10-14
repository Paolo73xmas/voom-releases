import { TRANSPORT_VERSION, type TransportRequest, type ValidationIssue, type ValidationResult } from './contract.ts';
import { type Check, fail, integer, number, object, range, record, text, uuid, values } from './checks.ts';
import { actionCheck } from './action-validation.ts';
const client = object({ platform: values('web', 'mobile') }, { appVersion: text(80) });
const departure = object({ lat: range(-90, 90), lng: range(-180, 180) }, { label: text(200) });
// Structural GPS validation is strict. Semantically unusable but correctly typed GPS is ignored with a notice by context.ts.
const gps = object({ lat: number, lng: number, accuracyM: number, capturedAt: text(80, false) });
const common = { contractVersion: values(TRANSPORT_VERSION) };
const variants: Record<string, Check> = {
  capabilities: object({ ...common, operation: values('capabilities') }, { client }),
  create_session: object({ ...common, operation: values('create_session') }, { targetAgentId: uuid, client }),
  turn: object({ ...common, operation: values('turn'), sessionId: uuid, requestId: uuid, expectedRevision: integer },
    { message: text(2000), action: actionCheck, targetAgentId: uuid, departure, gps, client }),
  get_state: object({ ...common, operation: values('get_state'), sessionId: uuid }, { client }),
  get_request: object({ ...common, operation: values('get_request'), sessionId: uuid, requestId: uuid }, { client }),
  get_plan: object({ ...common, operation: values('get_plan'), sessionId: uuid, planId: uuid }, { client }),
};
export function validateTransportRequest(input: unknown): ValidationResult<TransportRequest> {
  const issues: ValidationIssue[] = [];
  if (!record(input)) return { ok: false, httpStatus: 400, errorCode: 'invalid_request', issues: [{ path: '$', rule: 'object' }] };
  if (input.contractVersion !== TRANSPORT_VERSION) return { ok: false, httpStatus: 400, errorCode: 'unsupported_contract', issues: [{ path: '$.contractVersion', rule: 'version' }] };
  if (typeof input.operation !== 'string' || !Object.hasOwn(variants, input.operation)) fail(issues, '$.operation', 'operation');
  else variants[input.operation](input, '$', issues);
  if (input.operation === 'turn' && Object.hasOwn(input, 'message') === Object.hasOwn(input, 'action')) fail(issues, '$', 'exactly_one_message_or_action');
  if (issues.length) return { ok: false, httpStatus: 400, errorCode: 'invalid_request', issues };
  // Fresh JSON tree: later caller mutations cannot bypass validation (e.g. during async work).
  return { ok: true, value: JSON.parse(JSON.stringify(input)) as TransportRequest };
}
export function parseTransportJson(textBody: string): ValidationResult<TransportRequest> {
  // Bound parsing too; no echo of payload or tokens in errors.
  if (textBody.length > 32768) return { ok: false, httpStatus: 400, errorCode: 'invalid_request', issues: [{ path: '$', rule: 'body_too_large' }] };
  try { return validateTransportRequest(JSON.parse(textBody)); }
  catch { return { ok: false, httpStatus: 400, errorCode: 'invalid_request', issues: [{ path: '$', rule: 'json' }] }; }
}