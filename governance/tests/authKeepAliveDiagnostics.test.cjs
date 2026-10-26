const { test } = require('node:test');const assert = require('node:assert/strict');const { EventEmitter } = require('node:events');const { PassThrough } = require('node:stream');
const { reportVerificationIssue, verificationExitCode } = require('../../utils/authVerificationResult.cjs');
const { runNodeScript, verifyIdentity } = require('../../utils/authKeepAliveRunner.cjs');
const { cleanCycle } = require('../../utils/authOperationsStore.cjs');
const { buildModel } = require('../../reporting/auth-operations/model.cjs');const { render } = require('../../reporting/auth-operations/render.cjs');
const now=Date.parse('2026-10-25T23:00:00Z');const at=new Date(now).toISOString();
function rows(status='HEALTHY'){return ['mx:primary','mx:second','pe:primary','co:primary','co:second','cl:primary'].map(key=>{const[market,slot]=key.split(':');return{market,slot,status};});}
function cycle(identities){return{schemaVersion:1,environment:'S2',startedAt:at,finishedAt:at,state:'COMPLETE',identities,events:[],finalized:[]};}
function model(identities){return buildModel({cycles:[cycle(identities)],environment:'S2',now,scheduler:{status:'RUNNING',intervalMinutes:15}});}
test('failure reporting emits only a typed enum, never private error text',()=>{
 const output=[];reportVerificationIssue({code:'AUTH_STOREFRONT_UNAVAILABLE',reason:'STOREFRONT_MAINTENANCE',message:'secret-cookie-token'},{env:{AUTH_KEEPALIVE:'1'},log:s=>output.push(s)});
 assert.deepEqual(output,['AUTH_HEALTH_ISSUE {"reason":"STOREFRONT_MAINTENANCE"}']);
 reportVerificationIssue({code:'AUTH_SIGNED_OUT',reason:'STOREFRONT_MAINTENANCE'},{env:{AUTH_KEEPALIVE:'1'},log:s=>output.push(s)});
 assert.match(output[1],/SIGNED_OUT/);assert.equal(verificationExitCode({code:'AUTH_SIGNED_OUT'},{AUTH_KEEPALIVE:'1'}),20);
 reportVerificationIssue(Error('secret-cookie-token'),{env:{},log:()=>assert.fail('no protocol outside keepalive')});
});
test('split child output preserves structured reason without retaining arbitrary stdout/stderr',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
 const result=runNodeScript('fixture',{}, {spawnChild:()=>child});
 child.stdout.write('secret-cookie-token\nAUTH_HEALTH_IS');child.stdout.write('SUE {"reason":"STOREFRONT_MAINTENANCE","token":"secret-cookie-token"}\n');child.stderr.write('TimeoutError secret-cookie-token');child.emit('close',21,null);
 const value=await result;assert.equal(value.diagnostic,'STOREFRONT_MAINTENANCE');assert.ok(!JSON.stringify(value).includes('secret-cookie-token'));
});
test('two maintenance failures remain transient and cannot be converted into expiration',async()=>{
 const value=await verifyIdentity({market:'pe',environment:'S2',slot:'primary'},{acquire:()=>()=>{},runScript:async()=>({code:21,diagnostic:'STOREFRONT_MAINTENANCE'}),pause:async()=>{},log(){}});
 assert.equal(value.status,'TRANSIENT_ERROR');assert.equal(value.reason,'STOREFRONT_MAINTENANCE');assert.equal(value.attempts,2);
});
test('cycle storage preserves only allowlisted reasons and drops account/session payloads',()=>{
 const value=cleanCycle(cycle([{market:'mx',slot:'primary',status:'TRANSIENT_ERROR',reason:'STOREFRONT_MAINTENANCE',cookie:'secret-cookie-token'},{market:'pe',slot:'primary',status:'UNPROVEN',reason:'secret-cookie-token'}]));
 assert.equal(value.identities[0].reason,'STOREFRONT_MAINTENANCE');assert.ok(!('reason'in value.identities[1]));assert.ok(!JSON.stringify(value).includes('secret-cookie-token'));
});
test('unverified session has a prominent warning even while scheduler is running',()=>{
 const identities=rows();identities[0]={...identities[0],status:'TRANSIENT_ERROR',reason:'STOREFRONT_MAINTENANCE'};
 const m=model(identities);assert.equal(m.sessions[0].reason,'STOREFRONT_MAINTENANCE');const html=render(m);
 assert.match(html,/AUTHENTICATION NOT CONFIRMED/);assert.match(html,/Staging maintenance blocks verification/);assert.match(html,/absence of a browser window does not prove authentication/);assert.ok(!html.includes('MANUAL ACTION REQUIRED'));
});
test('six proven healthy identities clear the unconfirmed banner; real human gates keep their own warning',()=>{
 assert.ok(!render(model(rows())).includes('AUTHENTICATION NOT CONFIRMED'));
 const identities=rows();identities[0].status='HUMAN_REQUIRED';assert.match(render(model(identities)),/MANUAL ACTION REQUIRED/);
});
