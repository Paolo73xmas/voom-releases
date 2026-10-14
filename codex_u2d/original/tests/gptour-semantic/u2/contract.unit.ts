import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTransportRequest as validate, parseTransportJson, validateTransportResponse, ERROR_POLICIES, mapU1Error,
  TRANSPORT_VERSION as V, type TransportAction } from '../../../supabase/functions/_shared/gptour-semantic-transport/index.ts';
import { SID, RID, goldenCases, turnFixture, errorFixture } from './golden-cases.ts';
let checks = 0;
function check(ok: unknown, label: string) { assert.ok(ok,label); checks++; }
const base = {contractVersion:V,operation:'turn',sessionId:SID,requestId:RID,expectedRevision:0};
const requests: Record<string,unknown>[] = [
  {contractVersion:V,operation:'capabilities'}, {contractVersion:V,operation:'create_session'},
  {...base,message:'domani'}, {...base,action:{type:'reset'}},
  {contractVersion:V,operation:'get_state',sessionId:SID}, {contractVersion:V,operation:'get_request',sessionId:SID,requestId:RID},
  {contractVersion:V,operation:'get_plan',sessionId:SID,planId:RID},
];
for (const req of requests) {
  check(validate(req).ok,`valid ${req.operation}`);
  for (const key of ['role','agentId','owner','tenantId','isAdmin','lease','budget','clock','state','__proto__','extra'])
    check(!validate({...req,[key]:'forbidden'}).ok,`unknown top ${String(req.operation)}:${key}`);
  for (const key of Object.keys(req)) { const copy={...req}; delete copy[key]; check(!validate(copy).ok,`missing ${req.operation}:${key}`); }
  check(validate({...req,client:{platform:'mobile',appVersion:'test'}}).ok,'diagnostic client');
  check(!validate({...req,client:{platform:'mobile',role:'admin'}}).ok,'nested unknown client');
}
for (const value of [null,[],true,1,'',Object.create({contractVersion:V})]) check(!validate(value).ok,'non-object denied');
for (const expectedRevision of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'0',null]) check(!validate({...base,expectedRevision,message:'x'}).ok,'bad revision');
for (const message of ['', '  ','x'.repeat(2001),null,1,{}]) check(!validate({...base,message}).ok,'bad message');
check(validate({...base,message:'x'.repeat(2000)}).ok,'message max');
check(!validate({...base,message:'x',action:{type:'reset'}}).ok,'message+action denied');
check(!validate({...base,message:'x',action:undefined}).ok,'present undefined action denied');
check(!validate({...base,action:{type:'reset'},message:null}).ok,'present null message denied');
for (const id of ['', 'not-uuid',SID.toUpperCase(),SID+'x']) check(!validate({...base,sessionId:id,message:'x'}).ok,'bad ID');
check(!validate({...base,message:'x',departure:{lat:91,lng:10}}).ok,'departure range');
check(!validate({...base,message:'x',departure:{lat:45,lng:10,accuracyM:1}}).ok,'departure unknown');
check(validate({...base,message:'x',gps:{lat:91,lng:10,accuracyM:201,capturedAt:'bad'}}).ok,'typed unusable GPS accepted for notice');
check(!validate({...base,message:'x',gps:{lat:'45',lng:10,accuracyM:1,capturedAt:'x'}}).ok,'untyped GPS denied');
check(!validate({...base,message:'x',gps:{lat:45,lng:10,accuracyM:1,capturedAt:'x',role:'admin'}}).ok,'GPS unknown');
check(!parseTransportJson('{broken').ok,'JSON malformed');
check(!parseTransportJson(' '.repeat(32769)).ok,'bounded parser');
const unsupported=validate({...base,contractVersion:'semantic-1.0',message:'x'});
check(!unsupported.ok && unsupported.errorCode === 'unsupported_contract','unsupported version');
const actions: TransportAction[] = [{type:'answer',questionId:'q1',optionId:'yes'},{type:'dismiss_question',questionId:'q1'},
  {type:'follow_up_decision',eventId:'fu-1',decision:'include'},{type:'propose_reschedule',eventId:'fu-1',proposedDate:'2026-10-16'},
  {type:'require_stop',key:'c-1'},{type:'exclude_stop',key:'c-1'}, {type:'set_date',date:'2026-10-16'}, {type:'reset'},
  {type:'grant_consent',kind:'non_working_day',questionId:'q1',dates:['2026-10-18']}, {type:'grant_consent',kind:'extra_days',questionId:'q1'}];
for (const action of actions) {
  check(validate({...base,action}).ok,'valid action '+action.type);
  check(!validate({...base,action:{...action,extra:1}}).ok,'action strict '+action.type);
  for (const key of Object.keys(action)) {
    if (key === 'dates' && action.type !== 'grant_consent') continue;
    const a:Record<string,unknown>={...action}; delete a[key];
    check(!validate({...base,action:a}).ok,'action required '+action.type+':'+key);
  }
}
for (const d of ['2026-02-30','2026-13-01','2026-1-01','2025-02-29']) check(!validate({...base,action:{type:'set_date',date:d}}).ok,'calendar invalid');
check(validate({...base,action:{type:'set_date',date:'2028-02-29'}}).ok,'leap date');
check(!validate({...base,action:{type:'grant_consent',kind:'non_working_day',questionId:'q1',dates:['2026-10-18','2026-10-18']}}).ok,'duplicate consent dates');
check(!validate({...base,action:{type:'grant_consent',kind:'extra_days',questionId:'q1',dates:['2026-10-18']}}).ok,'unexpected consent dates');
const original={...base,message:'  domani  ',client:{platform:'web' as const}}; const parsed=validate(original);
check(parsed.ok && parsed.value.operation === 'turn' && parsed.value.message === '  domani  ','no text rewrite');
original.client.platform='mobile' as 'web'; check(parsed.ok && parsed.value.client?.platform === 'web','validated object detached');

// semantic-1.1 goldens = proofs of the PREVIOUS version (byte-stable, still validatable); semantic-1.2 goldens = served contract.
const goldens=goldenCases();
for (const [version,file] of [['semantic-1.1','tests/gptour-semantic/u2/transport-goldens.json'],['semantic-1.2','tests/gptour-semantic/u2/transport-goldens-1.2.json']] as const) {
  const disk=JSON.parse(readFileSync(file,'utf8'));
  check(JSON.stringify(disk) === JSON.stringify(goldenCases(version)),`golden snapshot ${version} byte-content stable`);
  for (const row of disk) {
    check(row.simulatedDependencies.includes('storage'),'fixture declares simulated storage');
    const result=validateTransportResponse(row.response);
    check(result.ok,`response golden ${version} `+row.name+(!result.ok?JSON.stringify(result.issues):''));
    check(!validateTransportResponse({...row.response,leaseToken:'must-not-leak'}).ok,`response unknown field ${version} `+row.name);
  }
}
const v11=validate({...base,contractVersion:'semantic-1.1',message:'x'});
check(!v11.ok && v11.errorCode === 'unsupported_contract','semantic-1.1 requests are NOT served (no automatic compatibility)');
const e12=errorFixture('invalid_request');
const {correlationId:_c,...noCorr}=e12; void _c;
check(!validateTransportResponse({...noCorr,sessionId:null,requestId:null}).ok && validateTransportResponse({...e12,sessionId:null,requestId:null}).ok,'1.2 not_accepted error requires correlationId; null identity allowed');
check(!validateTransportResponse({...errorFixture('revision_conflict'),sessionId:null}).ok,'1.2 accepted error keeps real identity (null rejected)');
check(!validateTransportResponse({...turnFixture('planned'),correlationId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}).ok,'1.2 success never carries correlationId');
check(!validateTransportResponse({...errorFixture('invalid_request','semantic-1.1'),correlationId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}).ok,'1.1 body rejects correlationId (previous version unchanged)');
check(!validateTransportResponse(errorFixture('internal_error_unaccepted','semantic-1.1')).ok,'1.1 body rejects internal_error_unaccepted');
check(validateTransportResponse(errorFixture('internal_error_unaccepted')).ok && ERROR_POLICIES.internal_error_unaccepted.outcome==='not_accepted','1.2 internal_error_unaccepted is not_accepted/500');
const r=turnFixture('planned');
check(!validateTransportResponse({...r,openQuestionCount:99}).ok,'question count consistent');
check(!validateTransportResponse({...r,outcome:'recoverable'}).ok,'uncommitted plan rejected');
check(!validateTransportResponse({...r,plan:null}).ok,'planned requires plan');
check(!validateTransportResponse({...r,result:{...r.result!,criteria:{...r.result!.criteria,secret:'not-allowed'}}}).ok,'criteria strict');
check(!validateTransportResponse({...r,plan:{...r.plan!,lease_token:'not-allowed'}}).ok,'nested plan strict');
check(!validateTransportResponse({...r,result:{...r.result!,question:{id:'q1',kind:'unclear',text:'x',options:[],deferred:[]}}}).ok,'private deferred rejected');
check(!validateTransportResponse({...r,result:{...r.result!,revision:999}}).ok,'revision mismatch rejected');
for (const [code,status] of Object.entries({invalid_request:400,unsupported_contract:400,unauthenticated:401,pilot_not_enabled:403,
  forbidden_agent:403,agent_mismatch:403,request_id_reused:422,revision_conflict:409,unknown_question:409,context_changed:409,engine_changed:409,
  request_in_progress:409,llm_retryable:503,llm_invalid_output:502,llm_budget_exhausted:503,processing_expired:503,request_expired:410,session_unavailable:410,plan_unavailable:404,internal_error:500})) {
  check(ERROR_POLICIES[code as keyof typeof ERROR_POLICIES].httpStatus===status,'HTTP policy '+code);
}
check(mapU1Error('llm_timeout','retryable').policy.outcome==='recoverable','timeout recoverable distinguished');
check(mapU1Error('llm_timeout','exhausted').code==='llm_budget_exhausted','timeout terminal distinguished');
check(mapU1Error('invalid_request','unavailable').policy.outcome==='committed','accepted invalid request policy');
console.log(`U2_CONTRACT DONE checks=${checks} fail=0 goldens=${goldens.length} MOCKED downstream`);