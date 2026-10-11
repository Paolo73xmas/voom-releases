import { GPTOUR_CONTRACT_VERSION, GPTOUR_ENGINE_VERSION, type OrchestratorResponse, type Plan } from './wire-contract';
import type { RequestEnvelope } from './contract';
import { validCoordinate } from './coordinates';
import { OrchestratorError } from './errors';
function fail(): never { throw new OrchestratorError('INVALID_RESPONSE'); }
const string = (x: unknown): x is string => typeof x === 'string';
const number = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const strings = (x: unknown): boolean => Array.isArray(x) && x.every(string);
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const geo = (x: unknown): boolean => object(x) && validCoordinate({ latitude: x.lat as number, longitude: x.lng as number }) && (x.label === undefined || string(x.label));
export function validateWireResponse(raw: unknown, req: RequestEnvelope): asserts raw is OrchestratorResponse {
  if (!object(raw) || raw.contractVersion !== GPTOUR_CONTRACT_VERSION || raw.engineVersion !== GPTOUR_ENGINE_VERSION
    || raw.sessionId !== req.sessionId || raw.requestId !== req.requestId || !Number.isSafeInteger(raw.sessionRevision) || Number(raw.sessionRevision) < 0
    || !['needs_clarification', 'planning', 'ready', 'infeasible', 'blocked', 'failed'].includes(String(raw.status))
    || !string(raw.message) || !string(raw.generatedAt) || !strings(raw.pendingDecisions) || !strings(raw.conflicts)) fail();
  const c = raw.criteria;
  if (!object(c) || !['requiredKeys', 'requiredNames', 'excludedKeys', 'excludedNames', 'consents'].every(k => strings(c[k]))
    || !['date', 'startTime', 'endTime'].every(k => c[k] === null || string(c[k]))
    || !['wantAll', 'nonWorkingConfirmed', 'extraDaysApproved'].every(k => typeof c[k] === 'boolean')
    || ![c.dateAnchorTurn, c.maxDays].every(x => x === null || number(x))) fail();
  if (c.groups !== null && (!object(c.groups) || c.groups.version !== 1 || !['existing', 'newPoints', 'ownOnly', 'needsDays'].every(k => typeof (c.groups as Record<string, unknown>)[k] === 'boolean')
    || !(c.groups.inactiveDays === null || number(c.groups.inactiveDays)))) fail();
  if (c.area !== null && (!object(c.area) || !strings(c.area.comuni) || !(c.area.provincia === null || string(c.area.provincia)) || typeof c.area.exhaustive !== 'boolean')) fail();
  if (raw.question !== null) {
    const q = raw.question;
    if (!object(q) || !string(q.id) || !string(q.kind) || !string(q.text) || !Array.isArray(q.options)
      || !q.options.every(o => object(o) && string(o.id) && string(o.label))) fail();
  }
  const dq = raw.dataQuality;
  if (!object(dq) || !strings(dq.notes) || !['osrm', 'estimate', 'none'].includes(String(dq.routingSource))
    || !['candidatesComplete', 'poolTruncated', 'purchasesVerified', 'registryVerified'].every(k => typeof dq[k] === 'boolean')) fail();
  if (!object(raw.metrics) || !['durationMs', 'crmQueries', 'aiCalls', 'routingCalls'].every(k => number((raw.metrics as Record<string, unknown>)[k]))) fail();
  if (raw.planId !== null && !string(raw.planId)) fail();
  if (raw.errorCode !== undefined && !string(raw.errorCode)) fail();
  if (raw.plan !== null) validatePlan(raw.plan, req);
  if (raw.status === 'ready' && (!raw.plan || (raw.plan as Plan).verification !== 'verified_routing')) fail();
  if (raw.status === 'planning' && raw.plan && (raw.plan as Plan).verification !== 'estimated_routing') fail();
  if (raw.plan && (raw.plan as Plan).planId !== raw.planId) fail();
  const action = req.action as { type?: string; planId?: string } | undefined;
  if (raw.plan && action?.type === 'get_plan' && (raw.plan as Plan).planId !== action.planId) fail();
  if (raw.plan && ((raw.plan as Plan).sessionRevision > Number(raw.sessionRevision)
    || ((req.action as { type?: string } | undefined)?.type !== 'get_plan' && (raw.plan as Plan).sessionRevision !== raw.sessionRevision))) fail();
}
function validatePlan(p: unknown, req: RequestEnvelope): asserts p is Plan {
  if (!object(p) || !string(p.planId) || p.sessionId !== req.sessionId || p.contractVersion !== '1.0' || p.engineVersion !== GPTOUR_ENGINE_VERSION
    || !Number.isSafeInteger(p.sessionRevision) || Number(p.sessionRevision) < 0 || !string(p.generatedAt) || !string(p.snapshotRef)
    || !['verified_routing', 'estimated_routing'].includes(String(p.verification)) || !strings(p.warnings) || !strings(p.dependsOnPendingChanges)
    || !object(p.selectionReasons) || !Array.isArray(p.selectionReasons.selected) || !Array.isArray(p.selectionReasons.excluded)) fail();
  for (const e of p.selectionReasons.excluded) if (!object(e) || !string(e.key) || !string(e.name) || !string(e.reason)) fail();
  for (const e of p.selectionReasons.selected) if (!object(e) || !string(e.key) || !string(e.reason)) fail();
  if (p.days !== undefined && !Array.isArray(p.days)) fail();
  for (const [index, d] of [p, ...(Array.isArray(p.days) ? p.days : [])].entries()) {
    if (!object(d) || !string(d.date) || !geo(d.departure) || !(d.returnTo === null || geo(d.returnTo)) || !Array.isArray(d.stops)
      || ![d.startMin, d.finishMin, d.endMin].every(number) || !Array.isArray(d.geometry) || !object(d.totals)) fail();
    if (!['driveMin', 'visitMin', 'waitMin', 'breakMin', 'returnMin', 'totalMin', 'availableMin', 'bufferMin', 'totalKm'].every(k => number((d.totals as Record<string, unknown>)[k]))) fail();
    if (!d.geometry.every(g => Array.isArray(g) && g.length === 2 && validCoordinate({ latitude: g[0], longitude: g[1] }))) fail();
    for (const s of d.stops) if (!object(s) || !geo(s) || !['key', 'name', 'city', 'reason'].every(k => string(s[k]))
      || !['suggested', 'required_by_agent', 'appointment', 'follow_up_confirmed'].includes(String(s.role)) || !['existing', 'new'].includes(String(s.group))
      || !['arrivalMin', 'departureMin', 'travelMinFromPrev', 'travelKmFromPrev', 'waitMin', 'visitMin', 'lunchBeforeMin'].every(k => number(s[k]))
      || !(s.lastOrderDate === null || string(s.lastOrderDate)) || !(s.daysSinceOrder === null || number(s.daysSinceOrder)) || typeof s.outsideWindow !== 'boolean') fail();
    if (index && (!number(d.day) || !strings(d.warnings) || !strings(d.conflicts) || typeof d.returnHomeAfterDay !== 'boolean'
      || !['home', 'previous_day_end'].includes(String(d.startsFrom)) || !(d.nightKmHome === null || number(d.nightKmHome))
      || !['last_day', 'threshold', 'global', 'routing_unknown'].includes(String(d.nightDecision)))) fail();
  }
}