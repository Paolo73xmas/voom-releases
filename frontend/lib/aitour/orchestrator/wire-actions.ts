import type { Command, JsonValue, RequestEnvelope } from './contract';
import { OrchestratorError } from './errors';
import type { StructuredAction, OrchestratorRequest } from './wire-contract';
const fail = (): never => { throw new OrchestratorError('INVALID_REQUEST'); };
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const date = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Shape validation only, no interpretation of dates or commercial conditions. */
export function encodeWireAction(command: Command): StructuredAction {
  const input = command.input && !Array.isArray(command.input) && typeof command.input === 'object' ? command.input : {};
  const field = (key: string): string => text(input[key]) ? input[key] as string : fail();
  switch (command.name) {
    case 'answer': return { type: 'answer', questionId: field('questionId'), optionId: field('optionId'), ...(input.value === undefined ? {} : { value: field('value') }) };
    case 'set_date': { const value = field('date'); if (!date(value)) fail(); return { type: 'set_date', date: value }; }
    case 'set_start_time': { const time = field('time'); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(); return { type: 'set_start_time', time }; }
    case 'follow_up_decision': {
      const decision = field('decision'); if (!['include', 'exclude', 'propose_reschedule'].includes(decision)) fail();
      if (input.proposedDate !== undefined && !date(input.proposedDate)) fail();
      return { type: command.name, followUpId: field('followUpId'), decision: decision as 'include' | 'exclude' | 'propose_reschedule',
        ...(input.proposedDate === undefined ? {} : { proposedDate: input.proposedDate as string }) };
    }
    case 'require_stop': case 'exclude_stop': return { type: command.name, key: field('key') };
    case 'get_plan': return { type: 'get_plan', planId: field('planId') };
    case 'reset': return { type: 'reset' };
    default: return fail();
  }
}
export function validateWireRequest(request: RequestEnvelope): asserts request is RequestEnvelope & OrchestratorRequest {
  if (request.sessionId.length > 128 || request.requestId.length > 128 || (request.message?.length ?? 0) > 2000) fail();
  if (request.expectedRevision !== undefined && (!Number.isSafeInteger(request.expectedRevision) || Number(request.expectedRevision) < 0)) fail();
  if (request.action !== undefined) {
    const a = request.action as Record<string, JsonValue>;
    if (!a || Array.isArray(a) || typeof a !== 'object') fail();
    const { type, ...input } = a;
    const valid = encodeWireAction({ name: type as Command['name'], input });
    if (Object.keys(valid).length !== Object.keys(a).length || Object.entries(valid).some(([k, v]) => a[k] !== v)) fail();
  }
  for (const value of [request.departure, request.gps]) if (value !== undefined) {
    const p = value as { lat: number; lng: number };
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) fail();
  }
  if (request.departure !== undefined) {
    const p = request.departure as Record<string, JsonValue>;
    if (Object.keys(p).some(k => !['lat', 'lng', 'label'].includes(k)) || (p.label !== undefined && typeof p.label !== 'string')) fail();
  }
  if (request.gps !== undefined) {
    const p = request.gps as { accuracyM: number; capturedAt: string };
    if (Object.keys(p).some(k => !['lat', 'lng', 'accuracyM', 'capturedAt'].includes(k)) || !Number.isFinite(p.accuracyM) || p.accuracyM < 0 || !text(p.capturedAt)) fail();
  }
}