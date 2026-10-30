const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function verifierFixture(blocked=null, healthy=false, uiOverride=null, serverOverride=null, accessError=null) {
  const calls=[];
  const page={url:()=> 'about:blank',isClosed:()=>false,waitForTimeout:async()=>new Promise(r=>setTimeout(r,1)),goto:async url=>{if(!healthy)throw Object.assign(new Error('synthetic navigation unavailable'),{name:'TimeoutError'});calls.push(new URL(url).pathname);},getByText:()=>({first:()=>({waitFor:async()=>calls.push('cookie-ready')})}),evaluate:async()=>({})};
  const context={newPage:async()=>page,storageState:async()=>({cookies:[],origins:[]})};
  const browser={newContext:async()=>context,close:async()=>calls.push('close')};
  const dependencies={
    '@playwright/test':{chromium:{launchServer:async()=>({wsEndpoint:()=> 'ws://fixture-verifier',kill:async()=>calls.push('close')}),connect:async()=>browser}},
    './eppSession.cjs':{installEppSessionStorage:async()=>{},captureEppPageState:async(ctx,page)=>({storageState:await ctx.storageState(),sessionStorage:await page.evaluate()})},
    './eppAccessState.cjs':{proveEppAccess:async()=>{if(accessError)throw accessError;if(uiOverride)return uiOverride;if(healthy)return{status:'READY',reason:'AUTHENTICATED_EPP_HOMEPAGE'};throw new Error('Must not claim access after navigation failure');}},
    './eppServerProof.cjs':{watchEppServerProof:()=>({stop:()=>calls.push('stop'),settle:async()=>{},accepted:()=>serverOverride?serverOverride.userAccepted===true&&serverOverride.accessAccepted===true:healthy,snapshot:()=>serverOverride||({userAccepted:healthy,accessAccepted:healthy})})},
    './authStorefrontReady.cjs':{openAuthProfile:async()=>{throw new Error('Must not claim logout after navigation failure');}},
    './eppStorefrontOverlays.cjs':{installEppOverlayDismissal:async()=>{},dismissEppNotificationTutorial:async()=>{}},
    './eppNavigationGuard.cjs':{installEppNavigationGuard:async()=>({protectPage:async()=>{},lastBlocked:()=>blocked,dispose:async()=>calls.push('dispose')})},
  };
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../utils/eppSessionVerification.cjs'),'utf8'),{module,URL,setTimeout,clearTimeout,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
  return {verify:module.exports.verifyEppSnapshot,calls};
}
test('EPP navigation timeout closes its verifier and never masquerades as expired identity',async()=>{
  const {verify,calls}=verifierFixture();
  await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/fixture/')},{storageState:{},sessionStorage:{}}),e=>e.eppReason==='EPP_NAVIGATION_OR_RENDER_TIMEOUT'&&e.exitCode!==79);
  assert.deepEqual(calls,['stop','dispose','close']);
});

test('a saved identity still bootstraps staging before independent programme verification without login',async()=>{
  const {verify,calls}=verifierFixture(null,true);
  const result=await verify({programNamespace:'alianzas_co',rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/alianzas_co/alianzas_co/')},{storageState:{cookies:[{name:'existing-identity'}]},sessionStorage:{}});
  assert.deepEqual(calls.slice(0,3),['/getcookie.html','cookie-ready','/co/multistore/alianzas_co/alianzas_co/']);
  assert.equal(result.proof.storefrontAccepted,true);
  assert.equal(calls.at(-1),'close');
});
test('legacy programme health accepts its independently authenticated homepage without inventing a profile-menu requirement',async()=>{
 const {verify}=verifierFixture(null,true);
 const result=await verify({rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')},{storageState:{},sessionStorage:{}});
 assert.equal(result.proof.userAccepted,true);assert.equal(result.proof.accessAccepted,true);assert.equal(result.proof.storefrontAccepted,true);
});
test('a legacy welcome and entitlement alone cannot export an anonymous identity',async()=>{
 const {verify}=verifierFixture(null,true,{status:'READY',reason:'AUTHENTICATED_EPP_HOMEPAGE'},{userAccepted:false,accessAccepted:true,reason:'SERVER_IDENTITY_NOT_PROVEN'});
 await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')},{storageState:{},sessionStorage:{}},{timeout:10}),e=>e.eppReason==='SERVER_IDENTITY_NOT_PROVEN'&&e.exitCode===79);
});
test('EPP blocked Production return keeps its causal reason through verifier cleanup',async()=>{
  const {verify,calls}=verifierFixture({reason:'PRODUCTION_NAVIGATION_BLOCKED'});
  await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/fixture/')},{storageState:{},sessionStorage:{}}),e=>e.eppReason==='PRODUCTION_NAVIGATION_BLOCKED'&&e.exitCode===78);
  assert.deepEqual(calls,['stop','dispose','close']);
});

for(const reason of ['CORPORATE_ACTIVATION_REQUIRED','VERIFICATION_CODE_REJECTED'])test(`programme gate ${reason} is preserved without another login or polling loop`,async()=>{
  const {verify,calls}=verifierFixture(null,true,{status:'HUMAN_REQUIRED',reason});
  await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/alianzas_co/alianzas_co/')},{storageState:{},sessionStorage:{}}),e=>e.eppReason===reason&&e.exitCode===78&&e.eppStage==='PROGRAM_PROOF');
  assert.equal(calls.at(-1),'close');
});

test('a suspended verifier cannot hold a regional identity indefinitely',async()=>{
  const {verify,calls}=verifierFixture(null,true);
  await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/alianzas_co/alianzas_co/')},{storageState:{},sessionStorage:{}},{configureContext:()=>new Promise(()=>{}),overallTimeoutMs:20,cleanupTimeoutMs:20}),e=>e.eppReason==='EPP_VERIFICATION_DEADLINE');
  assert.ok(calls.includes('close'));
});

test('staging parking callback recovers cookie then canonical EPP without replaying login',async()=>{
 const {recoverEppParkingReturn}=require('../../utils/eppSessionVerification.cjs'),calls=[];
 const page={url:()=> 'https://stg2.shop.samsung.com/onlinestore/mx/SystemParking.html',goto:async u=>calls.push(u),getByText:()=>({filter:()=>({first:()=>({waitFor:async()=>calls.push('cookie-ready')})})})};
 const cfg={rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/')};
 assert.equal(await recoverEppParkingReturn(page,cfg),true);
 assert.deepEqual(calls,['https://stg2.shop.samsung.com/getcookie.html','cookie-ready',cfg.rootUrl.href]);
 for(const url of ['https://www.samsung.com/onlinestore/mx/SystemParking.html','https://stg.shop.samsung.com/onlinestore/mx/SystemParking.html','https://stg2.shop.samsung.com/mx/login']){
  assert.equal(await recoverEppParkingReturn({...page,url:()=>url,goto:async()=>assert.fail('must not navigate')},cfg),false);
 }
});

test('a menu timeout preserves conclusive anonymous programme proof but never invents it from pending responses',async()=>{
 for(const proven of [true,false]){
  const server=proven?{userAccepted:false,accessAccepted:true,reason:'SERVER_IDENTITY_NOT_PROVEN'}:{userAccepted:false,accessAccepted:false,reason:'SERVER_PROOF_PENDING'};
  const {verify}=verifierFixture(null,true,null,server,Object.assign(Error('synthetic menu timeout'),{name:'TimeoutError'}));
  await assert.rejects(verify({rootUrl:new URL('https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/')},{storageState:{},sessionStorage:{}}),e=>e.eppReason===(proven?'SERVER_IDENTITY_NOT_PROVEN':'EPP_NAVIGATION_OR_RENDER_TIMEOUT')&&(proven?e.exitCode===79:e.exitCode!==79));
 }
});

test('verifier cleanup terminates only its exact owned process and waits for its exit',async()=>{
 const {EventEmitter}=require('node:events'),{terminateOwnedVerifier}=require('../../utils/eppSessionVerification.cjs');
 const child=new EventEmitter();child.exitCode=null;child.signalCode=null;const calls=[];
 child.kill=signal=>{calls.push(signal);queueMicrotask(()=>{child.signalCode=signal;child.emit('exit');});return true;};
 await terminateOwnedVerifier({process:()=>child,kill:()=>assert.fail('must not invoke the hanging high-level close')},50);
 assert.deepEqual(calls,['SIGKILL']);assert.equal(child.listenerCount('exit'),0);
 await terminateOwnedVerifier({process:()=>child,kill:()=>assert.fail('already exited')},50);
 assert.deepEqual(calls,['SIGKILL']);
});
