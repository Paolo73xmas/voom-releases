import { ACTION_NAMES, SERVER_STATUSES, type RequestEnvelope, type ServerSnapshot, type PlanView, type OptionView } from './contract';
import { validCoordinate } from './coordinates';
import { validRevision, jsonSafe } from './request';
import { OrchestratorError } from './errors';
const strings = (xs: unknown): xs is string[] => Array.isArray(xs) && xs.every(s => typeof s === 'string');
const id = (value: unknown): boolean => typeof value === 'string' && value.length > 0;
const optionalText = (value: unknown): boolean => value === undefined || typeof value === 'string';
function options(values: OptionView[]): void {
  if (!Array.isArray(values)) throw new Error('options');
  for (const o of values) if (!id(o.id) || typeof o.label !== 'string' || !ACTION_NAMES.includes(o.command?.name)
    || (o.command.input !== undefined && !jsonSafe(o.command.input))) throw new Error('option');
}
/** Structural checks on the INTERNAL renderer model. Wire decoding must precede this. No planning decisions. */
export function assertSnapshot(s: ServerSnapshot, request: RequestEnvelope): void {
  try {
    if (!s || s.sessionId !== request.sessionId || !validRevision(s.revision) || !SERVER_STATUSES.includes(s.status)) throw new Error('identity');
    if (typeof request.expectedRevision === 'number' && typeof s.revision === 'number' && s.revision < request.expectedRevision) throw new Error('stale');
    if (!strings(s.warnings) || !Array.isArray(s.messages) || !Array.isArray(s.questions)) throw new Error('shape');
    for (const m of s.messages) if (!id(m.id) || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string') throw new Error('message');
    for (const q of s.questions) { if (!id(q.id) || typeof q.text !== 'string') throw new Error('question'); options(q.options); }
    if (s.status === 'ready' && !s.plan) throw new Error('ready without plan');
    if (s.plan) {
      if (!['verified', 'estimated', 'unknown'].includes(s.plan.routing) || !strings(s.plan.warnings) || !Array.isArray(s.plan.days) || !s.plan.days.length) throw new Error('plan');
      for (const d of s.plan.days) {
        if (!id(d.id) || !id(d.date) || typeof d.title !== 'string' || !validCoordinate(d.start.coordinate) || typeof d.start.label !== 'string'
          || (d.end && (!validCoordinate(d.end.coordinate) || typeof d.end.label !== 'string')) || !optionalText(d.overnight)
          || !strings(d.breaks) || !strings(d.commitments) || !strings(d.warnings)) throw new Error('day');
        if (!Array.isArray(d.geometry) || !d.geometry.every(validCoordinate) || !Array.isArray(d.metrics) || !Array.isArray(d.stops)) throw new Error('arrays');
        for (const m of d.metrics) if (!id(m.id) || typeof m.label !== 'string' || typeof m.value !== 'string') throw new Error('metrics');
        for (const stop of d.stops) {
          if (!id(stop.id) || !validCoordinate(stop.coordinate) || !['sequence', 'name', 'arrival', 'departure', 'travel', 'visit'].every(k => typeof stop[k as keyof typeof stop] === 'string')
            || !optionalText(stop.wait) || !optionalText(stop.reason) || (stop.mandatory !== undefined && typeof stop.mandatory !== 'boolean')) throw new Error('stop');
          if (stop.options) options(stop.options);
        }
      }
    }
  } catch { throw new OrchestratorError('INVALID_RESPONSE'); }
}
export function definitivePlan(snapshot: ServerSnapshot | null, unconfirmed = false): PlanView | null {
  return !unconfirmed && snapshot?.status === 'ready' ? snapshot.plan : null;
}
/** An estimated plan may be shown only as a non-confirmable draft, never as a ready plan. */
export function visibleServerPlan(snapshot: ServerSnapshot | null, unconfirmed = false): PlanView | null {
  return !unconfirmed && snapshot && ['ready', 'planning'].includes(snapshot.status) ? snapshot.plan : null;
}