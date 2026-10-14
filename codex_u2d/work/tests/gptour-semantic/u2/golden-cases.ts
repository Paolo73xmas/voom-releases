// All storage/gate/plan/auth outcomes below are FIXTURES, NOT implemented dependencies.
import { newSemanticState, type SemanticResult } from '../../../supabase/functions/_shared/gptour-semantic/contract.ts';
import { emptyOperationalContext, projectState, projectResult, ERROR_POLICIES, TRANSPORT_VERSION, PREVIOUS_TRANSPORT_VERSIONS, TRANSPORT_ENGINE,
  type TransportResponse, type TurnResponse, type ErrorCode, type Gate, type TransportVersion } from '../../../supabase/functions/_shared/gptour-semantic-transport/index.ts';
import type { Plan } from '../../../supabase/functions/_shared/gptour-orchestrator/contract.ts';
export const SID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', RID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const AT = '2026-10-15T21:59:00Z', EXPIRES = '2026-10-22T21:59:00Z', CORR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
// Fixtures are versioned: 'semantic-1.1' reproduces the previous contract byte-for-byte (proof of the previous version); 'semantic-1.2' adds correlationId/nullable identity.
const state = newSemanticState(SID); state.revision = 1;
export const PLAN: Plan = {
  planId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', sessionId: SID, sessionRevision: 1, engineVersion: 'MOCKED-planner', contractVersion: '1.0', generatedAt: AT,
  date: '2026-10-16', startMin: 480, finishMin: 480, endMin: 1080, departure: {lat:45,lng:9}, returnTo: null, stops: [],
  totals: {driveMin:0,visitMin:0,waitMin:0,breakMin:0,returnMin:0,totalMin:0,availableMin:600,bufferMin:0,totalKm:0}, geometry: [],
  verification: 'estimated_routing', snapshotRef: 'MOCKED-not-a-real-plan', selectionReasons: {selected:[],excluded:[]}, warnings: ['MOCKED'], dependsOnPendingChanges: [],
};
const result: SemanticResult = {contractVersion:'semantic-1.0',sessionId:SID,requestId:RID,status:'updated',revision:1,criteria:state.criteria,
  changed:[],applied:[],rejected:[],question:null,errorCode:null,message:'MOCKED response',notices:[],diagnostics:{interpreter:'none',llmCalls:0,model:null,ms:0}};
export function turnFixture(gate: Gate, V: TransportVersion = TRANSPORT_VERSION): TurnResponse {
  const q = gate === 'planned' ? null : {id:'q1',kind:'unclear' as const,text:'MOCKED question',options:[]};
  return {operation:'turn',contractVersion:V as typeof TRANSPORT_VERSION,engineVersion:TRANSPORT_ENGINE,sessionId:SID,requestId:RID,sessionRevision:1,
    outcome:'committed',errorCode:null,retryableSameRequest:false,nextAction:'none',retryAfterMs:null,acceptedAt:AT,responseExpiresAt:EXPIRES,
    result:{...projectResult({...result,question:q}),contractVersion:V as typeof TRANSPORT_VERSION},gate,plan:gate === 'planned' ? PLAN : null,openQuestions:q?[q]:[],openQuestionCount:q?1:0,notApplied:[],dataQuality:null};
}
export function errorFixture(code: ErrorCode, V: TransportVersion = TRANSPORT_VERSION, ids: {sessionId: string | null; requestId: string | null} = {sessionId: SID, requestId: RID}): TurnResponse {
  const p = ERROR_POLICIES[code];
  return {operation:'turn',contractVersion:V as typeof TRANSPORT_VERSION,engineVersion:TRANSPORT_ENGINE,sessionId:ids.sessionId,requestId:ids.requestId,...(V === 'semantic-1.1' ? {} : {correlationId: CORR}),sessionRevision:null,
    outcome:p.outcome,errorCode:code,retryableSameRequest:p.retryableSameRequest,nextAction:p.nextAction,
    retryAfterMs:p.retryableSameRequest?1000:null,acceptedAt:p.outcome === 'committed'?AT:null,responseExpiresAt:p.outcome === 'committed'?EXPIRES:null,
    result:null,gate:null,plan:null,openQuestions:[],openQuestionCount:0,notApplied:[],dataQuality:null};
}
export function goldenCases(V: TransportVersion = TRANSPORT_VERSION): Array<{name:string; simulatedDependencies: string[]; response:TransportResponse}> {
  const old = V === 'semantic-1.1';
  const cases: Array<{name:string; simulatedDependencies:string[]; response:TransportResponse}> = [];
  const push = (name:string,response:TransportResponse) => cases.push({name,simulatedDependencies:['auth','storage','lease','budget','CRM','planner'],response});
  push('capabilities',{operation:'capabilities',contractVersion:V as typeof TRANSPORT_VERSION,engineVersion:TRANSPORT_ENGINE,enabled:false,
    operations:['capabilities','create_session','turn','get_state','get_request','get_plan'],...(old ? {} : {supportedVersions:[TRANSPORT_VERSION],previousVersions:[...PREVIOUS_TRANSPORT_VERSIONS]})} as TransportResponse);
  for (const operation of ['create_session','get_state'] as const) { push(operation,{operation,contractVersion:V as typeof TRANSPORT_VERSION,
    state:projectState(operation === 'create_session'?newSemanticState(SID):state,emptyOperationalContext(),{engineVersion:TRANSPORT_ENGINE,expiresAt:EXPIRES,gate:null,notices:[]})}); if (old) (cases.at(-1)!.response as {state:{contractVersion:string}}).state.contractVersion = V; }
  push('get_plan',{operation:'get_plan',contractVersion:V as typeof TRANSPORT_VERSION,plan:PLAN,expiresAt:EXPIRES,isCurrentRevision:true});
  for (const status of ['not_found','pending','done','expired'] as const) push('receipt_'+status,{operation:'get_request',contractVersion:V as typeof TRANSPORT_VERSION,sessionId:SID,requestId:RID,
    receipt:{status,processingExpired:false,recoverable:status === 'pending',processingDeadline:status === 'pending'?'2026-10-15T22:04:00Z':null,
      responseExpiresAt:status === 'not_found'?null:EXPIRES,retryAfterMs:status === 'pending'?1000:null,originalHttpStatus:status === 'done'?503:null,
      response:status === 'done'?errorFixture('llm_budget_exhausted',V):null}});
  push('receipt_pending_expired',{operation:'get_request',contractVersion:V as typeof TRANSPORT_VERSION,sessionId:SID,requestId:RID,
    receipt:{status:'pending',processingExpired:true,recoverable:false,processingDeadline:'2026-10-15T22:04:00Z',responseExpiresAt:EXPIRES,retryAfterMs:null,originalHttpStatus:null,response:null}});
  for (const gate of ['pending_question','blocked','needs_consent','planned'] as const) push('gate_'+gate,turnFixture(gate,V));
  for (const code of (Object.keys(ERROR_POLICIES) as ErrorCode[]).filter(c => !old || c !== 'internal_error_unaccepted')) push('error_'+code,errorFixture(code,V));
  if (!old) { push('error_invalid_request_no_identity',errorFixture('invalid_request',V,{sessionId:null,requestId:null})); push('error_forbidden_session_partial_identity',errorFixture('forbidden_session',V,{sessionId:SID,requestId:null})); }
  return cases;
}