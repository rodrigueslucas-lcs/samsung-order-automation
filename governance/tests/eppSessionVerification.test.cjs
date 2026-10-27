const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function verifierFixture(blocked=null) {
  const calls=[];
  const page={goto:async()=>{throw Object.assign(new Error('synthetic navigation unavailable'),{name:'TimeoutError'});}};
  const context={newPage:async()=>page};
  const browser={newContext:async()=>context,close:async()=>calls.push('close')};
  const dependencies={
    '@playwright/test':{chromium:{launch:async()=>browser}},
    './eppSession.cjs':{installEppSessionStorage:async()=>{}},
    './eppAccessState.cjs':{proveEppAccess:async()=>{throw new Error('Must not claim access after navigation failure');}},
    './eppServerProof.cjs':{watchEppServerProof:()=>({stop:()=>calls.push('stop')})},
    './authStorefrontReady.cjs':{openAuthProfile:async()=>{throw new Error('Must not claim logout after navigation failure');}},
    './eppStorefrontOverlays.cjs':{installEppOverlayDismissal:async()=>{},dismissEppNotificationTutorial:async()=>{}},
    './eppNavigationGuard.cjs':{installEppNavigationGuard:async()=>({protectPage:async()=>{},lastBlocked:()=>blocked,dispose:async()=>calls.push('dispose')})},
  };
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../utils/eppSessionVerification.cjs'),'utf8'),{module,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
  return {verify:module.exports.verifyEppSnapshot,calls};
}
test('EPP navigation timeout closes its verifier and never masquerades as expired identity',async()=>{
  const {verify,calls}=verifierFixture();
  await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/fixture/')},{storageState:{},sessionStorage:{}}),e=>e.eppReason==='EPP_NAVIGATION_OR_RENDER_TIMEOUT'&&e.exitCode!==79);
  assert.deepEqual(calls,['stop','dispose','close']);
});
test('EPP blocked Production return keeps its causal reason through verifier cleanup',async()=>{
  const {verify,calls}=verifierFixture({reason:'PRODUCTION_NAVIGATION_BLOCKED'});
  await assert.rejects(verify({rootUrl:new URL('https://stg2.shop.samsung.com/fixture/')},{storageState:{},sessionStorage:{}}),e=>e.eppReason==='PRODUCTION_NAVIGATION_BLOCKED'&&e.exitCode===78);
  assert.deepEqual(calls,['stop','dispose','close']);
});
