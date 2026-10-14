import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {verifyUserJwt} from './final/supabase/functions/gptour-semantic-v2/auth.ts';
import {parseOrigin} from './final/supabase/functions/gptour-semantic-v2/env.ts';
import {makeRevalidation} from './final/supabase/functions/gptour-semantic-v2/adapters/revalidation.ts';
import {makePostgrestCatalog,makePostgrestSettings} from './final/supabase/functions/gptour-semantic-v2/adapters/catalog-postgrest.ts';
import {DependencyError} from './final/supabase/functions/_shared/gptour-semantic-runtime/ports.ts';
import {canonicalJson,sha256Hex} from './final/supabase/functions/_shared/gptour-semantic-runtime/canonical.ts';
const results=[];
async function test(name,fn){try{await fn();results.push({name,result:'pass'})}catch(e){results.push({name,result:'fail',error:e.message})}}
const secret='independent-local-synthetic-secret';
const base={sub:'11111111-1111-4111-8111-111111111111',role:'authenticated',exp:2000000000};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
async function jwt(claims=base,header={alg:'HS256'}){const body=b64(header)+'.'+b64(claims);return body+'.'+Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('base64url')}
await test('valid JWT',async()=>assert.equal((await verifyUserJwt(await jwt(),secret,0)).uid,base.sub));
for(const token of [null,'','a.b','a.b.c.d','!!!.e30.AA',b64({alg:'HS256'})+'.'+b64(base)+'.!!!',b64([])+'.'+b64(base)+'.'+'A'.repeat(43)])await test('malformed JWT '+String(token).slice(0,18),async()=>assert.equal(await verifyUserJwt(token,secret,0),null));
await test('wrong signature',async()=>assert.equal(await verifyUserJwt(await jwt(),'wrong',0),null));
await test('expired JWT',async()=>assert.equal(await verifyUserJwt(await jwt(),secret,2100000000000),null));
await test('invalid sub',async()=>assert.equal(await verifyUserJwt(await jwt({...base,sub:'bad'}),secret,0),null));
await test('invalid exp',async()=>assert.equal(await verifyUserJwt(await jwt({...base,exp:'bad'}),secret,0),null));
await test('wrong alg',async()=>assert.equal(await verifyUserJwt(await jwt(base,{alg:'none'}),secret,0),null));
await test('origin wildcard literal rejected',()=>assert.throws(()=>parseOrigin('*')));
await test('origin path rejected',()=>assert.throws(()=>parseOrigin('https://example.com/path')));
await test('valid origin',()=>assert.equal(parseOrigin('https://example.com'),'https://example.com'));
const catalog={localities:[{name:'Roma',provincia:'RM'}],provinces:[],events:[],stops:[],projects:[]};
const ctx={state:{},acceptedAt:'x',engineVersion:'v1',contextEngineVersion:'v1',catalogHash:await sha256Hex(canonicalJson(catalog))};
await test('revalidation unchanged',async()=>assert.deepEqual(await makeRevalidation('A',{load:async()=>catalog}).check(ctx),{ok:true}));
await test('revalidation engine change',async()=>assert.deepEqual(await makeRevalidation('A',{load:async()=>{throw Error('must not load')}}).check({...ctx,engineVersion:'v2'}),{ok:false,code:'engine_changed'}));
await test('revalidation catalog change',async()=>assert.deepEqual(await makeRevalidation('A',{load:async()=>({...catalog,events:[{id:'x'}]})}).check(ctx),{ok:false,code:'context_changed'}));
await test('revalidation load fault recoverable',async()=>assert.rejects(()=>makeRevalidation('A',{load:async()=>{throw Error('offline')}}).check(ctx),DependencyError));
const originalFetch=globalThis.fetch;
try{
globalThis.fetch=async()=>new Response('unavailable',{status:503});
await test('catalog HTTP 503 recoverable',async()=>assert.rejects(()=>makePostgrestCatalog('http://synthetic.invalid','synthetic').load('A'),DependencyError));
globalThis.fetch=async()=>new Response('not-json',{status:200});
await test('catalog malformed JSON recoverable',async()=>assert.rejects(()=>makePostgrestCatalog('http://synthetic.invalid','synthetic').load('A'),DependencyError));
globalThis.fetch=async()=>new Response('{}',{status:200});
await test('catalog invalid shape recoverable',async()=>assert.rejects(()=>makePostgrestCatalog('http://synthetic.invalid','synthetic').load('A'),DependencyError));
await test('settings invalid shape must not silently become unknown',async()=>assert.rejects(()=>makePostgrestSettings('http://synthetic.invalid','synthetic').workingDays('A'),DependencyError));
globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.error(new TypeError('synthetic interrupted body stream'))}}),{status:200});
await test('catalog interrupted response body recoverable',async()=>assert.rejects(()=>makePostgrestCatalog('http://synthetic.invalid','synthetic').load('A'),DependencyError));
}finally{globalThis.fetch=originalFetch}
const report={runtime:process.version,checks:results.length,passed:results.filter(r=>r.result==='pass').length,results};
writeFileSync(new URL('./probe-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
process.exitCode=results.some(r=>r.result==='fail')?1:0;
