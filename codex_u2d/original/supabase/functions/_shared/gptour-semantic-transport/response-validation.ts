// Strict public response wire validation, including nested U1 criteria and Plan 1.0. Versioned: semantic-1.2 (served) and semantic-1.1 (previous, validatable only).
// Validation is NOT proof of a DB commit; only a future storage receipt can supply that evidence.
import { CATEGORIES, CONSENT_KINDS } from '../gptour-semantic/contract.ts';
import { MAX_OPERATIONS, validateLlmOutput } from '../gptour-semantic/schema.ts';
import { VALIDATABLE_TRANSPORT_VERSIONS, type TransportResponse, type TransportVersion, type ValidationIssue, type ValidationResult } from './contract.ts';
import { ERROR_POLICIES } from './errors.ts';
import { type Check, date, fail, integer, isTimestamp, list, number, object, range, record, text, uuid, values } from './checks.ts';
const nullable = (check: Check): Check => (v, p, e) => { if (v !== null) check(v, p, e); };
const bool = values(true, false), str = text(10000, false), id = text(128);
const timestamp: Check = (v, p, e) => { if (typeof v !== 'string' || !isTimestamp(v)) fail(e, p, 'timestamp'); };
const time: Check = (v, p, e) => { if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail(e, p, 'time'); };
const geo = object({ lat: range(-90, 90), lng: range(-180, 180) }, { label: text(200) });
const gps = object({ lat: range(-90, 90), lng: range(-180, 180), accuracyM: range(0, 200), capturedAt: timestamp });
const question = object({ id, kind: values('area_ambiguous','unsupported_criteria','locality_ambiguous','locality_unknown','reference_unknown','reference_ambiguous','consent','invalid_value','unclear','llm_error'),
  text: str, options: list(object({ id: text(512), label: str })) });
const segment = object({ categories: list(values(...CATEGORIES)), allCategories: bool, minDaysSinceOrder: nullable(integer), minDaysSinceVisit: nullable(integer), ownOnly: bool });
const stopRef = object({ key: id, name: str });
const criteria = object({ schema: values(1), segments: list(segment),
  area: nullable(object({ localities: list(object({ name: str, provincia: nullable(str) })), provincia: nullable(str), allowNearby: bool })),
  dates: list(date, 0, 366), startTime: nullable(time), endTime: nullable(time), revenue: nullable(object({ min: nullable(number), max: nullable(number) })),
  project: nullable(str), coverage: values('selection','all_matching'), maxDays: nullable(integer), overflowPolicy: nullable(values('ask','extend_days','drop_excess')),
  lodging: nullable(object({ mode: values('home','away','conditional'), maxKmHome: nullable(number) })), followUpsMode: values('consider','skip'),
  stops: object({ required: list(stopRef), excluded: list(stopRef) }),
  followUps: list(object({ eventId: id, label: str, decision: values('include','exclude') })),
  rescheduleProposals: list(object({ eventId: id, label: str, fromDate: date, proposedDate: date, status: values('proposed') })),
  consents: list(object({ kind: values(...CONSENT_KINDS), source: values('answer','action'), turn: integer, detail: nullable(number), dates: nullable(list(date, 0, 366)) })) });
const quality = object({ candidatesComplete: bool, poolTruncated: bool, purchasesVerified: bool, registryVerified: bool, routingSource: values('osrm','estimate','none'), notes: list(str) });
const totals = object(Object.fromEntries(['driveMin','visitMin','waitMin','breakMin','returnMin','totalMin','availableMin','bufferMin','totalKm'].map(k => [k, number])));
const planStop = object({ key: id, name: str, city: str, lat: range(-90,90), lng: range(-180,180), role: values('suggested','required_by_agent','appointment','follow_up_confirmed'), group: values('existing','new'),
  ...Object.fromEntries(['arrivalMin','departureMin','travelMinFromPrev','travelKmFromPrev','waitMin','visitMin','lunchBeforeMin'].map(k => [k, number])),
  reason: str, lastOrderDate: nullable(date), daysSinceOrder: nullable(integer), outsideWindow: bool });
const coord: Check = (v,p,e) => { list(number,2,2)(v,p,e); if (Array.isArray(v)) { range(-180,180)(v[0],p+'[0]',e); range(-90,90)(v[1],p+'[1]',e); } };
const dayFields = { date, startMin: number, finishMin: number, endMin: number, departure: geo, returnTo: nullable(geo), stops: list(planStop,0,10000), totals, geometry: list(coord,0,100000) };
const plan = object({ planId: id, sessionId: uuid, sessionRevision: integer, engineVersion: str, contractVersion: values('1.0'), generatedAt: timestamp,
  ...dayFields, verification: values('verified_routing','estimated_routing'), snapshotRef: str,
  selectionReasons: object({ selected: list(object({ key: id, reason: str }),0,10000), excluded: list(object({ key: id, name: str, reason: str }),0,10000) }),
  warnings: list(str), dependsOnPendingChanges: list(str) }, { days: list(object({ ...dayFields, day: integer, startsFrom: values('home','previous_day_end'),
    returnHomeAfterDay: bool, nightKmHome: nullable(number), nightDecision: values('last_day','threshold','global','routing_unknown'), warnings: list(str), conflicts: list(str) }),1,366) });
// result.applied = operations ALREADY applied by the server. LLM provenance always carries a non-empty citation (validateLlmOutput enforces it before apply);
// server provenance (buttons/answers/gate options) carries evidence '' — no user citation is ever invented. Whitespace-only evidence is neither and is rejected.
const SERVER_PROVENANCE = 'server';
const applied: Check = (v,p,e) => {
  if (!Array.isArray(v) || v.length > MAX_OPERATIONS) { fail(e,p,'operations_schema'); return; }
  for (const [i,o] of v.entries()) {
    const ev = record(o) ? o.evidence : undefined;
    if (typeof ev !== 'string' || (ev !== '' && !ev.trim())) { fail(e,`${p}[${i}]`,'operations_schema'); continue; }
    if (!validateLlmOutput({ operations: [ev === '' ? { ...o, evidence: SERVER_PROVENANCE } : o], clarification: null }).ok) fail(e,`${p}[${i}]`,'operations_schema');
  }
};
function buildVariants(V: TransportVersion): Record<string, Check> {
const result = object({ contractVersion: values(V), sessionId: uuid, requestId: uuid, status: values('updated','needs_clarification','error'), revision: integer,
  criteria, changed: list(str), applied, rejected: list(object({ op: str, reason: str })), question: nullable(question),
  errorCode: nullable(values('unsupported_contract','invalid_request','revision_conflict','llm_unavailable','llm_timeout','llm_invalid_output','unknown_question')),
  message: str, notices: list(str), diagnostics: object({ interpreter: values('llm','structured_action','none'), llmCalls: integer, model: nullable(str), ms: number }) });
const gate = nullable(values('pending_question','blocked','needs_consent','planned'));
const context = object({ departure: nullable(geo), departureSource: nullable(values('explicit','gps','settings')), acquiredAt: nullable(timestamp), gps: nullable(gps), lastPlanId: nullable(id), planRevision: nullable(integer) });
const snapshot = object({ contractVersion: values(V), engineVersion: str, sessionId: uuid, sessionRevision: integer, criteria, question: nullable(question),
  openQuestions: list(question), openQuestionCount: integer, notices: list(str), gate, context, expiresAt: timestamp });
const errorCodes = Object.keys(ERROR_POLICIES).filter(c => V !== 'semantic-1.1' || c !== 'internal_error_unaccepted');
const turn = object({ operation: values('turn'), contractVersion: values(V), engineVersion: str, sessionId: V === 'semantic-1.1' ? uuid : nullable(uuid), requestId: V === 'semantic-1.1' ? uuid : nullable(uuid),
  sessionRevision: nullable(integer), outcome: values('committed','recoverable','unknown','not_accepted','expired'), errorCode: nullable(values(...errorCodes)),
  retryableSameRequest: bool, nextAction: values('none','correct_request','update_client','authenticate','restore_access','retry_same_request','get_request','get_state_and_confirm','create_session_and_confirm','confirm_new_turn','contact_support'),
  retryAfterMs: nullable(integer), acceptedAt: nullable(timestamp), responseExpiresAt: nullable(timestamp), result: nullable(result), gate, plan: nullable(plan),
  openQuestions: list(question), openQuestionCount: integer, notApplied: list(object({ reason: str, criterion: str })), dataQuality: nullable(quality) }, V === 'semantic-1.1' ? {} : { correlationId: nullable(uuid) });
const variants: Record<string, Check> = {
  turn, capabilities: object({ operation: values('capabilities'), contractVersion: values(V), engineVersion: str,
    operations: list(values('capabilities','create_session','turn','get_state','get_request','get_plan')), enabled: bool }, V === 'semantic-1.1' ? {} : { supportedVersions: list(values(...VALIDATABLE_TRANSPORT_VERSIONS)), previousVersions: list(values(...VALIDATABLE_TRANSPORT_VERSIONS)) }),
  create_session: object({ operation: values('create_session'), contractVersion: values(V), state: snapshot }),
  get_state: object({ operation: values('get_state'), contractVersion: values(V), state: snapshot }),
  get_plan: object({ operation: values('get_plan'), contractVersion: values(V), plan, expiresAt: timestamp, isCurrentRevision: bool }),
  get_request: object({ operation: values('get_request'), contractVersion: values(V), sessionId: uuid, requestId: uuid,
    receipt: object({ status: values('not_found','pending','done','expired'), processingExpired: bool, recoverable: bool,
      processingDeadline: nullable(timestamp), responseExpiresAt: nullable(timestamp), retryAfterMs: nullable(integer), originalHttpStatus: nullable(range(100,599)), response: nullable(turn) }) }),
};
return variants;
}
const VARIANTS = Object.fromEntries(VALIDATABLE_TRANSPORT_VERSIONS.map(v => [v, buildVariants(v)])) as Record<TransportVersion, Record<string, Check>>;
function consistency(v: Record<string, unknown>, e: ValidationIssue[], V: TransportVersion): void {
  if (Array.isArray(v.openQuestions) && v.openQuestionCount !== v.openQuestions.length) fail(e,'$.openQuestionCount','count_mismatch');
  if (v.operation === 'turn') {
    if (V !== 'semantic-1.1') {
      // 1.2 identity rules: null only for absent/invalid identifiers of a request that was NOT accepted; correlationId identifies the error, never the request.
      if (v.errorCode === null && (v.sessionId === null || v.requestId === null)) fail(e,'$','success_without_identity');
      if (v.errorCode === null && v.correlationId != null) fail(e,'$.correlationId','correlation_on_success');
      if (v.errorCode !== null && v.outcome === 'not_accepted' && typeof v.correlationId !== 'string') fail(e,'$.correlationId','missing_correlation');
      if (v.errorCode !== null && v.outcome !== 'not_accepted' && (v.sessionId === null || v.requestId === null)) fail(e,'$','accepted_without_identity');
    }
    if (record(v.result) && (v.result.sessionId !== v.sessionId || v.result.requestId !== v.requestId || v.result.revision !== v.sessionRevision)) fail(e,'$.result','identity_revision_mismatch');
    if (v.outcome !== 'committed' && (v.result !== null || v.gate !== null || v.plan !== null)) fail(e,'$','uncommitted_result');
    if (v.errorCode !== null && (v.gate !== null || v.plan !== null)) fail(e,'$','error_with_plan');
    if (v.outcome === 'committed' && (v.acceptedAt === null || v.responseExpiresAt === null)) fail(e,'$','missing_commit_metadata');
    if (v.outcome === 'not_accepted' && (v.acceptedAt !== null || v.responseExpiresAt !== null)) fail(e,'$','unaccepted_metadata');
    if ((v.acceptedAt === null) !== (v.responseExpiresAt === null)) fail(e,'$','partial_acceptance_metadata');
    if (typeof v.acceptedAt === 'string' && typeof v.responseExpiresAt === 'string' && Date.parse(v.responseExpiresAt) <= Date.parse(v.acceptedAt)) fail(e,'$','invalid_response_window');
    if (typeof v.errorCode === 'string' && Object.hasOwn(ERROR_POLICIES,v.errorCode)) {
      const policy = ERROR_POLICIES[v.errorCode as keyof typeof ERROR_POLICIES];
      const acceptedInvalid = v.errorCode === 'invalid_request' && v.outcome === 'committed';
      if (!acceptedInvalid && v.outcome !== policy.outcome) fail(e,'$.outcome','error_outcome_mismatch');
      if (v.retryableSameRequest !== policy.retryableSameRequest || v.nextAction !== policy.nextAction) fail(e,'$','error_recovery_mismatch');
      if (record(v.result) && v.result.status !== 'error') fail(e,'$.result','error_has_success_result');
    }
    if (v.outcome === 'committed' && v.errorCode === null && (!record(v.result) || v.gate === null)) fail(e,'$','missing_application_result');
    if (v.gate === 'planned' && v.plan === null) fail(e,'$.plan','planned_without_plan');
    if (v.plan !== null && v.gate !== 'planned') fail(e,'$.plan','plan_without_planned');
    if (record(v.plan) && (v.plan.sessionId !== v.sessionId || v.plan.sessionRevision !== v.sessionRevision)) fail(e,'$.plan','identity_revision_mismatch');
  }
  if (record(v.state)) consistency(v.state,e,V);
  if (record(v.receipt)) {
    const r = v.receipt;
    if (r.status === 'done' && (r.originalHttpStatus === null || !record(r.response) || r.response.outcome !== 'committed' || r.recoverable !== false)) fail(e,'$.receipt','done_requires_terminal_response');
    if (r.status === 'pending' && r.processingExpired === false && r.recoverable !== true) fail(e,'$.receipt','pending_requires_recovery');
    if (r.status === 'pending' && (r.processingDeadline === null || r.responseExpiresAt === null)) fail(e,'$.receipt','pending_requires_deadlines');
    if (r.status !== 'done' && (r.response !== null || r.originalHttpStatus !== null)) fail(e,'$.receipt','nonterminal_receipt_has_response');
    if ((r.processingExpired === true || r.status === 'expired' || r.status === 'not_found') && r.recoverable !== false) fail(e,'$.receipt','not_recoverable');
    if (record(r.response)) {
      consistency(r.response,e,V);
      if (r.response.sessionId !== v.sessionId || r.response.requestId !== v.requestId) fail(e,'$.receipt','identity_mismatch');
      const code=r.response.errorCode;
      const expected=typeof code === 'string' && Object.hasOwn(ERROR_POLICIES,code) ? ERROR_POLICIES[code as keyof typeof ERROR_POLICIES].httpStatus : 200;
      if (r.originalHttpStatus !== expected) fail(e,'$.receipt.originalHttpStatus','terminal_http_mismatch');
    }
  }
}
export function validateTransportResponse(input: unknown): ValidationResult<TransportResponse> {
  const issues: ValidationIssue[] = [];
  const V = record(input) && (VALIDATABLE_TRANSPORT_VERSIONS as readonly unknown[]).includes(input.contractVersion) ? input.contractVersion as TransportVersion : null;
  if (!V) fail(issues,'$.contractVersion','version');
  else if (!record(input) || typeof input.operation !== 'string' || !Object.hasOwn(VARIANTS[V],input.operation)) fail(issues,'$','response_operation');
  else { VARIANTS[V][input.operation](input,'$',issues); if (!issues.length) consistency(input,issues,V); }
  return issues.length ? { ok:false, httpStatus:400, errorCode:'invalid_request', issues } : { ok:true, value: structuredClone(input) as TransportResponse };
}