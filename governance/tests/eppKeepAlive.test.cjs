const {test}=require('node:test');
const assert=require('node:assert/strict');
const {getEppConfig}=require('../../config/markets/epp');
const {getEppSessionPaths,loadEppSession}=require('../../utils/eppSession.cjs');
const {maintainIdentity,runCycle,makeBundle,validateBundle,contentHash}=require('../../utils/eppKeepAlive.cjs');
const {sessionContentHash}=require('../../utils/authBundleContent.cjs');
const cfg=getEppConfig('MX',{ENVIRONMENT:'S2'});
const snapshot=()=>({storageState:{cookies:[{domain:'stg2.shop.samsung.com',path:'/',name:'fixture',value:'private-cookie-fixture'}],origins:[]},sessionStorage:{fixture:'private-session-fixture'},proof:{userAccepted:true,accessAccepted:true}});
function fixture(sequence=['HEALTHY']){
  const calls=[];let checkpoint={},index=0;
  const d={acquire:()=>{calls.push('acquire');const lease={env:{},release:()=>calls.push('release')};return lease;},read:()=>checkpoint,save:(_cfg,value)=>{checkpoint=value;},load:()=>snapshot(),verify:async()=>{calls.push('verify');const item=sequence[Math.min(index++,sequence.length-1)];return item==='HEALTHY'?{status:item,snapshot:snapshot(),proof:snapshot().proof}:typeof item==='string'?{status:item,reason:item==='INVALID'?'SERVER_IDENTITY_NOT_PROVEN':'NETWORK_ERROR'}:item;},capture:async()=>null,refresh:async(_cfg,_env,options)=>{calls.push(options.resumeOnly?'resume':'refresh');return{status:'REFRESHED'};},persist:()=>calls.push('persist'),package:()=>{calls.push('package');return'fixture-bundle';},publish:async()=>calls.push('publish')};
  d.clearHandoff=()=>calls.push('clearHandoff');
  return{d,calls,get state(){return checkpoint;},set state(value){checkpoint=value;}};
}
test('healthy EPP reuses one verification and never launches login',async()=>{const f=fixture();const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'KEEP_ALIVE_OK');assert.equal(r.action,'SESSION_REUSED');assert.equal(f.calls.filter(c=>c==='verify').length,1);assert.ok(!f.calls.includes('refresh'));assert.equal(f.calls.at(-1),'release');});

test('native capture timeout stays UNPROVEN, releases the lease and cannot trigger login or publish',async()=>{
 const f=fixture(['INVALID']);let disposed=false;
 f.d.capture=async()=>({readEppSnapshot:async()=>{throw Object.assign(new Error('snapshot stalled'),{code:'EPP_NATIVE_SNAPSHOT_TIMEOUT'});},dispose:async()=>{disposed=true;}});
 const r=await maintainIdentity(cfg,{allowRefresh:true,publish:true},f.d);
 assert.equal(r.status,'UNPROVEN');assert.equal(r.reason,'EPP_NATIVE_SNAPSHOT_TIMEOUT');assert.ok(disposed);
 assert.equal(f.calls.at(-1),'release');for(const action of ['refresh','persist','package','publish'])assert.ok(!f.calls.includes(action));
});
test('first invalid check then healthy check does not renew',async()=>{const f=fixture(['INVALID','HEALTHY']);const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'KEEP_ALIVE_OK');assert.ok(!f.calls.includes('refresh'));});
test('two confirmed invalid checks permit exactly one refresh and independent post-check',async()=>{const f=fixture(['INVALID','INVALID','HEALTHY']);const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'REFRESHED');assert.equal(f.calls.filter(c=>c==='refresh').length,1);assert.equal(f.calls.filter(c=>c==='verify').length,3);});
test('a network or disagreeing result never authorizes login',async()=>{for(const sequence of [['UNPROVEN'],['INVALID','UNPROVEN']]){const f=fixture(sequence);const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'UNPROVEN');assert.ok(!f.calls.includes('refresh'));assert.ok(!f.calls.includes('persist'));}});
for(const reason of ['PRODUCTION_NAVIGATION_BLOCKED','VERIFICATION_CODE_REJECTED','EPP_ENTITLEMENT_NOT_PROVEN'])test(reason+' remains blocked without refresh or bundle replacement',async()=>{const f=fixture([{status:'BLOCKED',reason}]);const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.reason,reason);assert.equal(f.state.blockedReason,reason);assert.ok(!f.calls.includes('refresh'));assert.ok(!f.calls.includes('package'));});
test('known external checkpoint is verified but never relogs while invalid',async()=>{const f=fixture(['INVALID']);f.state={blockedReason:'VERIFICATION_CODE_REJECTED'};assert.equal((await maintainIdentity(cfg,{allowRefresh:true},f.d)).reason,'VERIFICATION_CODE_REJECTED');assert.ok(!f.calls.includes('refresh'));});
test('a now-healthy session clears a prior external blocker without login',async()=>{const f=fixture();f.state={blockedReason:'VERIFICATION_CODE_REJECTED'};assert.equal((await maintainIdentity(cfg,{},f.d)).status,'KEEP_ALIVE_OK');assert.equal(f.state.blockedReason,null);});

test('old corporate activation checkpoint permits one recovery only after two matching invalid identity checks',async()=>{
 const f=fixture(['INVALID','INVALID','HEALTHY']);f.state={blockedReason:'CORPORATE_ACTIVATION_REQUIRED'};
 const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);
 assert.equal(r.status,'REFRESHED');assert.equal(f.calls.filter(x=>x==='refresh').length,1);
 assert.equal(f.calls.filter(x=>x==='verify').length,3);assert.equal(f.state.blockedReason,null);
});
test('corporate checkpoint cannot turn network ambiguity or a current entitlement gate into login',async()=>{
 for(const next of [{status:'UNPROVEN',reason:'NETWORK_ERROR'},{status:'BLOCKED',reason:'CORPORATE_ACTIVATION_REQUIRED'}]){
  const f=fixture(['INVALID',next]);f.state={blockedReason:'CORPORATE_ACTIVATION_REQUIRED'};
  await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.ok(!f.calls.includes('refresh'));
  assert.equal(f.state.blockedReason,'CORPORATE_ACTIVATION_REQUIRED');
 }
});
test('CAPTCHA persists HUMAN_REQUIRED and only resumes an existing browser next time',async()=>{const f=fixture(['INVALID']);f.d.capture=async()=>({readEppSnapshot:async()=>null,dispose:async()=>{},closeVerified:async()=>assert.fail('human browser must stay open')});f.d.refresh=async(_cfg,_env,options)=>{f.calls.push(options.resumeOnly?'resume':'refresh');options.onHuman();return{status:'HUMAN_REQUIRED'};};assert.equal((await maintainIdentity(cfg,{allowRefresh:true},f.d)).status,'HUMAN_REQUIRED');assert.equal(f.state.human,true);assert.equal((await maintainIdentity(cfg,{allowRefresh:true},f.d)).status,'HUMAN_REQUIRED');assert.equal(f.calls.filter(c=>c==='refresh').length,1);assert.equal(f.calls.filter(c=>c==='resume').length,1);});
test('missing retained browser permits one fresh recovery only after two definite invalid checks',async()=>{const f=fixture(['INVALID','INVALID','HEALTHY']);f.state={human:true};const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'REFRESHED');assert.equal(f.calls.filter(c=>c==='refresh').length,1);assert.ok(!f.calls.includes('resume'));assert.equal(f.calls.filter(c=>c==='verify').length,3);});

test('an existing audited human window may resume after an inconclusive context check without starting login',async()=>{const f=fixture(['UNPROVEN','HEALTHY']);f.state={human:true};f.d.capture=async()=>({readEppSnapshot:async()=>null,dispose:async()=>{},closeVerified:async()=>{}});assert.equal((await maintainIdentity(cfg,{allowRefresh:true},f.d)).status,'REFRESHED');assert.ok(f.calls.includes('resume'));assert.ok(!f.calls.includes('refresh'));});

test('an external checkpoint remains BLOCKED during inconclusive checks and never becomes a CAPTCHA request',async()=>{const f=fixture(['UNPROVEN']);f.state={human:true,blockedReason:'VERIFICATION_CODE_REJECTED'};const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'BLOCKED');assert.equal(r.blockerSource,'CHECKPOINT');assert.equal(r.currentReason,'NETWORK_ERROR');assert.ok(!f.calls.includes('refresh'));});
test('unchanged bundle publishes once; changed content publishes again',async()=>{const f=fixture();await maintainIdentity(cfg,{publish:true},f.d);await maintainIdentity(cfg,{publish:true},f.d);assert.equal(f.calls.filter(c=>c==='publish').length,1);f.d.verify=async()=>{const s=snapshot();s.storageState.cookies[0].value='renewed-private-fixture';return{status:'HEALTHY',snapshot:s,proof:s.proof};};await maintainIdentity(cfg,{publish:true},f.d);assert.equal(f.calls.filter(c=>c==='publish').length,2);});
test('publish failure retains acknowledgement and does not close a human browser',async()=>{const f=fixture(['INVALID','HEALTHY']);f.state={human:true,publishedHash:'old-ack'};f.d.capture=async()=>({readEppSnapshot:async()=>snapshot(),closeVerified:async()=>assert.fail('publish failed'),dispose:async()=>{}});f.d.publish=async()=>{throw Error('fixture publish failure');};const r=await maintainIdentity(cfg,{publish:true},f.d);assert.equal(r.status,'PUBLISH_FAILED');assert.equal(f.state.publishedHash,'old-ack');});
test('package failure cannot publish or claim healthy finalization',async()=>{const f=fixture();f.d.package=()=>{throw Error('fixture package failure');};assert.equal((await maintainIdentity(cfg,{publish:true},f.d)).status,'UNPROVEN');assert.ok(!f.calls.includes('publish'));});
test('native EPP callback is independently verified, published, then closed',async()=>{const f=fixture(['INVALID','HEALTHY']);f.state={human:true};f.d.capture=async()=>({readEppSnapshot:async()=>snapshot(),closeVerified:async()=>f.calls.push('close'),dispose:async()=>f.calls.push('disconnect')});const r=await maintainIdentity(cfg,{publish:true},f.d);assert.equal(r.status,'REFRESHED');assert.ok(f.calls.indexOf('close')>f.calls.indexOf('publish'));assert.ok(!f.calls.includes('refresh'));});
test('BUSY lock prevents every session operation',async()=>{const f=fixture();f.d.acquire=()=>{throw Object.assign(new Error('busy'),{code:'AUTH_BUSY'});};assert.equal((await maintainIdentity(cfg,{},f.d)).status,'BUSY');assert.deepEqual(f.calls,[]);});
test('same-market concurrency is serialized by the existing EPP lease',async()=>{const f=fixture();let occupied=false;f.d.acquire=()=>{if(occupied)throw Object.assign(new Error('busy'),{code:'AUTH_BUSY'});occupied=true;return{env:{},release:()=>{occupied=false;}};};const results=await Promise.all([maintainIdentity(cfg,{},f.d),maintainIdentity(cfg,{},f.d)]);assert.deepEqual(results.map(r=>r.status).sort(),['BUSY','KEEP_ALIVE_OK']);});
test('one market failure cannot discard other market results',async()=>{const f=fixture();const original=f.d.acquire;f.d.acquire=config=>{if(config.market==='PE')throw Error('fixture failure');return original();};const r=await runCycle({markets:['MX','PE','CO','CL']},f.d);assert.equal(r.identities.length,4);assert.equal(r.identities.filter(i=>i.status==='KEEP_ALIVE_OK').length,3);});
test('EPP SECOND has distinct files, profile and metadata; Base Store slot aliases are ignored',()=>{const first=getEppConfig('CO',{MX_AUTH_SLOT:'second',CO_AUTH_SLOT:'second'});const second=getEppConfig('CO',{EPP_AUTH_SLOT:'second'});assert.equal(first.authSlot,'primary');assert.notEqual(getEppSessionPaths(first).directory,getEppSessionPaths(second).directory);assert.notEqual(getEppSessionPaths(first).profile,getEppSessionPaths(second).profile);assert.throws(()=>getEppConfig('PE',{EPP_AUTH_SLOT:'second'}),/Unsupported/);assert.throws(()=>getEppConfig('CL',{EPP_AUTH_SLOT:'second'}),/Unsupported/);const wrong={store:'EPP',market:'CO',environment:'S2',root:second.rootUrl.href,verified:true};assert.throws(()=>loadEppSession(second,{existsSync:()=>true,readFileSync:()=>JSON.stringify(wrong)}),/another multistore/);});
test('EPP bundle cannot be installed as Base Store or another slot/programme',()=>{const b=makeBundle(cfg,snapshot());assert.throws(()=>sessionContentHash(b),/Invalid session bundle/);assert.throws(()=>validateBundle({...cfg,authSlot:'second'},b),/mismatch/);assert.throws(()=>validateBundle({...cfg,environment:'S1'},b),/mismatch/);assert.throws(()=>makeBundle(cfg,{...snapshot(),proof:{userAccepted:false,accessAccepted:true}}),/Unproven/);assert.deepEqual(validateBundle(cfg,b).storageState,snapshot().storageState);});
test('hash ignores cookie ordering, not cookie or store/slot contents',()=>{const s=snapshot();s.storageState.cookies.push({...s.storageState.cookies[0],name:'other'});const a=makeBundle(cfg,s);s.storageState.cookies.reverse();assert.equal(contentHash(a),contentHash(makeBundle(cfg,s)));assert.notEqual(contentHash(a),contentHash(makeBundle({...cfg,authSlot:'second'},s)));});

test('one pending human EPP gate prevents another visible refresh in the regional cycle',async()=>{const f=fixture(['INVALID']);f.d.read=()=>({});f.d.save=()=>{};f.d.refresh=async()=>{f.calls.push('refresh');return{status:'HUMAN_REQUIRED'};};const result=await runCycle({markets:['MX','CO','CL'],allowRefresh:true},f.d);assert.equal(f.calls.filter(c=>c==='refresh').length,1);assert.equal(result.identities[0].status,'HUMAN_REQUIRED');assert.equal(result.identities.find(r=>r.market==='CO').reason,'EPP_INTERACTIVE_GATE_PENDING');assert.equal(result.identities.find(r=>r.market==='CL').reason,'EPP_INTERACTIVE_GATE_PENDING');});

test('CO S2 restricted programme verifies a real existing session without starting login',async()=>{
  const actual=getEppConfig('CO',{ENVIRONMENT:'S2',CO_EPP_PROGRAM:'co_epp_agre'}),restricted={...actual,programPolicy:{...actual.programPolicy,allowAutomaticRetry:false,knownStatus:'BLOCKED_CALLBACK_TO_PRODUCTION'}};
  assert.equal(restricted.programPolicy.allowAutomaticRetry,false);
  const f=fixture(['HEALTHY']);
  const r=await maintainIdentity(restricted,{allowRefresh:true,publish:false},f.d);
  assert.equal(r.status,'KEEP_ALIVE_OK');
  assert.equal(r.action,'SESSION_REUSED');
  assert.equal(f.calls.filter(c=>c==='verify').length,1);
  assert.ok(!f.calls.includes('refresh'));
  assert.ok(f.calls.includes('persist'));
});
test('CO S2 restricted programme remains blocked after read-only verification fails',async()=>{
  const actual=getEppConfig('CO',{ENVIRONMENT:'S2',CO_EPP_PROGRAM:'co_epp_agre'}),restricted={...actual,programPolicy:{...actual.programPolicy,allowAutomaticRetry:false,knownStatus:'BLOCKED_CALLBACK_TO_PRODUCTION'}};
  const f=fixture([{status:'INVALID',reason:'SERVER_IDENTITY_NOT_PROVEN'}]);
  const r=await maintainIdentity(restricted,{allowRefresh:true,publish:true},f.d);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.reason,'BLOCKED_CALLBACK_TO_PRODUCTION');
  assert.equal(r.blockerSource,'PROGRAM_POLICY');
  assert.equal(r.currentReason,'SERVER_IDENTITY_NOT_PROVEN');
  assert.equal(r.loginAttempts,0);
  assert.ok(f.calls.includes('verify'));
  for(const forbidden of ['refresh','persist','package','publish'])assert.ok(!f.calls.includes(forbidden));
});
test('MX security checkpoint stays protected after its automatic recovery budget is used',async()=>{
  const f=fixture([{status:'INVALID',reason:'SERVER_IDENTITY_NOT_PROVEN'}]);
  f.state={blockedReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED',blockerObservedAt:'2026-11-03T16:00:00Z',securityAutomaticRetryAt:'2026-11-03T17:00:00Z'};
  const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.reason,'SAMSUNG_ACCOUNT_SECURITY_BLOCKED');
  assert.equal(r.blockerSource,'CHECKPOINT');
  assert.equal(r.currentReason,'SERVER_IDENTITY_NOT_PROVEN');
  assert.equal(r.blockerObservedAt,'2026-11-03T16:00:00Z');
  assert.ok(!f.calls.includes('refresh'));
});
test('a verified MX profile removes its obsolete security checkpoint without a login replay',async()=>{
  const f=fixture(['HEALTHY']);
  f.state={blockedReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};
  const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);
  assert.equal(r.status,'KEEP_ALIVE_OK');
  assert.equal(f.state.blockedReason,null);
  assert.ok(!f.calls.includes('refresh'));
});

test('S2 keepalive uses the same operational programmes as regional refresh',async()=>{
 const f=fixture(),seen={};f.d.acquire=c=>{seen[c.market]=c.program;return{env:{},release(){}};};
 await runCycle({environment:'S2',markets:['MX','PE','CO','CL'],env:{}},f.d);
 assert.deepEqual(seen,{MX:'pymesmx',PE:'pe_membership_vip',CO:'co_epp_agre',CL:'alianzas'});
 const explicit=fixture();explicit.d.acquire=c=>{assert.equal(c.program,'alianzas_co');return{env:{},release(){}};};
 await runCycle({environment:'S2',markets:['CO'],env:{CO_EPP_PROGRAM:'alianzas_co'}},explicit.d);
});
test('current native corporate gate overrides stale invalid bundle without login replay',async()=>{
 const f=fixture(['INVALID',{status:'BLOCKED',reason:'CORPORATE_ACTIVATION_REQUIRED',proof:{userAccepted:true,accessAccepted:true}}]);
 let closed=false;f.d.capture=async()=>({readEppSnapshot:async()=>snapshot(),closeVerified:async()=>{closed=true;},dispose:async()=>{}});
 const r=await maintainIdentity(cfg,{allowRefresh:true,publish:true},f.d);
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'CORPORATE_ACTIVATION_REQUIRED');assert.equal(r.proof.userAccepted,true);assert.equal(closed,false);
 for(const forbidden of ['refresh','persist','package','publish'])assert.ok(!f.calls.includes(forbidden));
});
test('native transient failure cannot restart an audited human login',async()=>{
 const f=fixture(['INVALID',{status:'UNPROVEN',reason:'SERVER_UNAVAILABLE'}]);
 f.d.capture=async()=>({readEppSnapshot:async()=>snapshot(),dispose:async()=>{}});
 const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);
 assert.equal(r.status,'UNPROVEN');assert.equal(r.reason,'SERVER_UNAVAILABLE');assert.ok(!f.calls.includes('refresh'));
});

test('restricted programme preserves current gate and proof instead of reporting only old callback policy',async()=>{
 const actual=getEppConfig('CO',{ENVIRONMENT:'S2',CO_EPP_PROGRAM:'co_epp_agre'}),restricted={...actual,programPolicy:{...actual.programPolicy,allowAutomaticRetry:false,knownStatus:'BLOCKED_CALLBACK_TO_PRODUCTION'}};
 const f=fixture([{status:'BLOCKED',reason:'CORPORATE_ACTIVATION_REQUIRED',proof:{userAccepted:true,accessAccepted:true}}]);
 const r=await maintainIdentity(restricted,{allowRefresh:true},f.d);
 assert.equal(r.reason,'CORPORATE_ACTIVATION_REQUIRED');assert.equal(r.blockerSource,'CURRENT');assert.equal(r.programPolicyReason,'BLOCKED_CALLBACK_TO_PRODUCTION');assert.equal(r.proof.userAccepted,true);assert.equal(r.loginAttempts,0);
});

test('missing human browser with inconclusive health cannot start login',async()=>{
 const f=fixture(['UNPROVEN']);f.state={human:true};
 const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);
 assert.equal(r.status,'HUMAN_REQUIRED');assert.ok(!f.calls.includes('refresh'));assert.ok(!f.calls.includes('resume'));
});
test('missing human browser still requires allow-refresh and never ignores security blocker',async()=>{
 const f=fixture(['INVALID']);f.state={human:true};
 assert.equal((await maintainIdentity(cfg,{allowRefresh:false},f.d)).status,'HUMAN_REQUIRED');assert.ok(!f.calls.includes('refresh'));
 f.state={human:true,blockedReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};
 assert.equal((await maintainIdentity(cfg,{allowRefresh:true},f.d)).reason,'SAMSUNG_ACCOUNT_SECURITY_BLOCKED');assert.ok(!f.calls.includes('refresh'));
});

for(const reason of ['COMMERCE_CONTENT_NOT_RENDERED','EPP_COMMERCE_NOT_RENDERED']){
 test('historical '+reason+' permits one PE recovery after two matching invalid identity checks',async()=>{const f=fixture(['INVALID','INVALID','HEALTHY']);f.state={blockedReason:reason,blockerObservedAt:'2026-11-06T00:00:00Z'};const pe=getEppConfig('PE',{ENVIRONMENT:'S2',PE_EPP_PROGRAM:'pe_membership_vip'});const r=await maintainIdentity(pe,{allowRefresh:true},f.d);assert.equal(r.status,'REFRESHED');assert.equal(f.calls.filter(x=>x==='refresh').length,1);assert.equal(f.calls.filter(x=>x==='verify').length,3);assert.equal(f.state.blockedReason,null);});
 test(reason+' cannot turn current render/network uncertainty into login',async()=>{for(const next of [{status:'UNPROVEN',reason:'NETWORK_ERROR'},{status:'BLOCKED',reason},{status:'INVALID',reason:'SERVER_AUTH_REJECTED'}]){const f=fixture(['INVALID',next]);f.state={blockedReason:reason};await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.ok(!f.calls.includes('refresh'));assert.ok(!f.calls.includes('publish'));assert.equal(f.state.blockedReason,reason);}});
 test(reason+' cannot bypass a programme restriction or disabled refresh',async()=>{for(const options of [{allowRefresh:false},{allowRefresh:true,restricted:true}]){const f=fixture(['INVALID','INVALID','HEALTHY']);f.state={blockedReason:reason};const target=options.restricted?{...cfg,programPolicy:{allowAutomaticRetry:false,knownStatus:'BLOCKED_CALLBACK_TO_PRODUCTION'}}:cfg;await maintainIdentity(target,options,f.d);assert.ok(!f.calls.includes('refresh'));assert.equal(f.state.blockedReason,reason);}});
 test(reason+' recovery preserves the human CAPTCHA gate instead of publishing an unverified session',async()=>{const f=fixture(['INVALID','INVALID']);f.state={blockedReason:reason};f.d.refresh=async(_c,_e,options)=>{f.calls.push('refresh');options.onHuman();return{status:'HUMAN_REQUIRED',reason:'CAPTCHA_REQUIRED'};};const r=await maintainIdentity(cfg,{allowRefresh:true,publish:true},f.d);assert.equal(r.status,'HUMAN_REQUIRED');assert.equal(f.state.human,true);assert.equal(f.calls.filter(x=>x==='refresh').length,1);for(const action of ['persist','package','publish'])assert.ok(!f.calls.includes(action));});
}
for(const reason of ['NETWORK_ERROR','EPP_VERIFY_UNAVAILABLE','EPP_VERIFICATION_DEADLINE','EPP_NAVIGATION_OR_RENDER_TIMEOUT']){
 test('one transient '+reason+' is reverified and can reuse a healthy snapshot without login',async()=>{const f=fixture([{status:'UNPROVEN',reason},'HEALTHY']);const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'KEEP_ALIVE_OK');assert.equal(f.calls.filter(c=>c==='verify').length,2);assert.ok(!f.calls.includes('refresh'));});
 test('persistent '+reason+' remains unproven after two read-only checks without login or publish',async()=>{const f=fixture([{status:'UNPROVEN',reason}]);const r=await maintainIdentity(cfg,{allowRefresh:true,publish:true},f.d);assert.equal(r.status,'UNPROVEN');assert.equal(f.calls.filter(c=>c==='verify').length,2);assert.ok(!f.calls.includes('refresh'));assert.ok(!f.calls.includes('publish'));});
}
test('transient then signed-out still requires two matching identity rejections before one login',async()=>{const f=fixture([{status:'UNPROVEN',reason:'EPP_VERIFICATION_DEADLINE'},'INVALID','INVALID','HEALTHY']);const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'REFRESHED');assert.equal(f.calls.filter(c=>c==='refresh').length,1);assert.equal(f.calls.filter(c=>c==='verify').length,4);});
test('regional progress exposes the human gate before recovery returns',async()=>{const f=fixture(['INVALID']);const events=[];f.d.refresh=async(_cfg,_env,options)=>{options.onHuman();assert.ok(events.some(e=>e.status==='HUMAN_REQUIRED'));return{status:'HUMAN_REQUIRED',reason:'EPP_HUMAN_PENDING'};};await runCycle({markets:['MX'],allowRefresh:true,onProgress:e=>events.push(e)},f.d);assert.equal(events[0].status,'VERIFYING');assert.equal(events.at(-1).status,'HUMAN_REQUIRED');assert.ok(events.every(e=>!JSON.stringify(e).includes('private-')));});

test('ended EPP authorization clears stale human handoff without publishing or replaying',async()=>{const f=fixture(['INVALID','INVALID']);f.state={human:true};f.d.refresh=async()=>({status:'UNPROVEN',reason:'AUTHORIZATION_EXPIRED'});const r=await maintainIdentity(cfg,{allowRefresh:true,publish:true},f.d);assert.equal(r.reason,'AUTHORIZATION_EXPIRED');assert.equal(f.state.human,false);for(const action of ['persist','package','publish'])assert.ok(!f.calls.includes(action));});

test('retained terminal EPP window is cleaned before snapshot reuse without starting login on healthy proof',async()=>{const f=fixture(['HEALTHY']);f.state={human:true};f.d.capture=async()=>({closeRejected:async()=>{f.calls.push('terminal-close');return true;},dispose:async()=>f.calls.push('disconnect'),readEppSnapshot:()=>assert.fail('closed window must not be read')});const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'KEEP_ALIVE_OK');assert.equal(f.state.human,false);assert.ok(f.calls.includes('terminal-close'));assert.ok(!f.calls.includes('refresh'));});

test('read-only EPP health check never closes retained windows',async()=>{const f=fixture(['HEALTHY']);f.state={human:true};f.d.capture=async()=>({closeRejected:()=>assert.fail('read-only cannot close windows'),readEppSnapshot:async()=>null,dispose:async()=>{}});const r=await maintainIdentity(cfg,{allowRefresh:false},f.d);assert.equal(r.humanPending,true);assert.equal(f.state.human,true);});

test('healthy exported proof cannot hide an orphan terminal native EPP window with no human checkpoint',async()=>{const f=fixture(['HEALTHY']);let terminal=true;f.d.capture=async()=>({closeRejected:async()=>{terminal=false;return true;},dispose:async()=>{},readEppSnapshot:()=>assert.fail('closed terminal cannot become session proof')});const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'KEEP_ALIVE_OK');assert.equal(terminal,false);assert.ok(!f.calls.includes('refresh'));});

test('EPP repeated cycles preserve a live challenge then recover after terminal expiry and network outage',async()=>{
 const f=fixture();let phase='INVALID',window='CLOSED',logins=0,checks=0;
 f.d.verify=async()=>{checks++;return phase==='HEALTHY'?{status:'HEALTHY',snapshot:snapshot(),proof:snapshot().proof}:phase==='NETWORK'?{status:'UNPROVEN',reason:'NETWORK_ERROR'}:{status:'INVALID',reason:'SERVER_IDENTITY_NOT_PROVEN'};};
 f.d.capture=async()=>window==='CLOSED'?null:{closeRejected:async()=>{if(window!=='TERMINAL')return false;window='CLOSED';return true;},readEppSnapshot:async()=>null,dispose:async()=>{}};
 f.d.refresh=async(_cfg,_env,options)=>{assert.equal(options.resumeOnly,false);logins++;window='CHALLENGE';return{status:'HUMAN_REQUIRED',reason:'CAPTCHA_REQUIRED'};};
 await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(logins,1);assert.equal(checks,2);
 phase='NETWORK';window='TERMINAL';await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(window,'CLOSED');assert.equal(logins,1);assert.equal(f.state.human,false);
 phase='INVALID';await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(logins,2);assert.equal(window,'CHALLENGE');
 phase='HEALTHY';window='CLOSED';const result=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(result.status,'KEEP_ALIVE_OK');assert.equal(logins,2);assert.equal(f.state.human,false);
});

test('closed EPP security denial persists before closure and prevents the next-cycle login',async()=>{const f=fixture(['INVALID']);let visible=true;f.d.capture=async()=>visible?{closeSecurityBlocked:async persist=>{await persist();assert.equal(f.state.blockedReason,'SAMSUNG_ACCOUNT_SECURITY_BLOCKED');visible=false;return true;},dispose:async()=>{}}:null;f.d.refresh=()=>assert.fail('security denial cannot start new login');for(let cycle=0;cycle<2;cycle++){const r=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'SAMSUNG_ACCOUNT_SECURITY_BLOCKED');assert.equal(visible,false);}});

for(const reason of ['EPP_REFRESH_NOT_PROVEN','EPP_HANDOFF_NOT_READY'])test('historical internal failure permits recovery only after two invalid checks: '+reason,async()=>{const f=fixture(['INVALID','INVALID','HEALTHY']);f.state={blockedReason:reason,human:true};f.d.capture=async()=>({hasAccountHandoff:async()=>false,readEppSnapshot:async()=>null,closeVerified:async()=>{},dispose:async()=>{}});const result=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(result.status,'REFRESHED');assert.equal(f.calls.filter(x=>x==='refresh').length,1);assert.ok(!f.calls.includes('resume'));});
test('network uncertainty cannot clear historical internal failure or authorize login',async()=>{const f=fixture(['UNPROVEN']);f.state={blockedReason:'EPP_REFRESH_NOT_PROVEN'};await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(f.state.blockedReason,'EPP_REFRESH_NOT_PROVEN');assert.ok(!f.calls.includes('refresh'));});

test('explicit reviewed EPP denial recovery requires two invalid checks and one official refresh',async()=>{const f=fixture(['INVALID','INVALID','HEALTHY']);f.state={blockedReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};const result=await maintainIdentity(cfg,{allowRefresh:true,retrySecurityBlocked:true},f.d);assert.equal(result.status,'REFRESHED');assert.equal(f.calls.filter(x=>x==='refresh').length,1);assert.ok(f.state.securityReviewAt);});
test('reviewed EPP recovery cannot use network uncertainty as permission to clear security denial',async()=>{const f=fixture(['UNPROVEN']);f.state={blockedReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};await maintainIdentity(cfg,{allowRefresh:true,retrySecurityBlocked:true},f.d);assert.ok(!f.calls.includes('refresh'));assert.equal(f.state.blockedReason,'SAMSUNG_ACCOUNT_SECURITY_BLOCKED');});

test('old EPP provider denial gets one automatic recovery after cooldown, never repeated after denial',async()=>{const f=fixture(['INVALID','INVALID']);f.state={blockedReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED',blockerObservedAt:new Date(Date.now()-7200000).toISOString()};let attempts=0;f.d.refresh=async()=>{attempts++;return{status:'BLOCKED',reason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};};await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(attempts,1);await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(attempts,1);});

test('explicit reviewed recovery can replace its closed denied window only after two invalid checks',async()=>{const f=fixture(['INVALID','INVALID','HEALTHY']);f.d.capture=async()=>({closeSecurityBlocked:async persist=>{await persist();return true;},dispose:async()=>{}});const result=await maintainIdentity(cfg,{allowRefresh:true,retrySecurityBlocked:true},f.d);assert.equal(result.status,'REFRESHED');assert.equal(f.calls.filter(x=>x==='refresh').length,1);});

test('fresh EPP provider denial is closed immediately after recorded child result',async()=>{const f=fixture(['INVALID','INVALID']);let visible=false;f.d.capture=async()=>visible?{closeSecurityBlocked:async persist=>{await persist();assert.equal(f.state.blockedReason,'SAMSUNG_ACCOUNT_SECURITY_BLOCKED');visible=false;return true;},dispose:async()=>{}}:null;f.d.refresh=async()=>{visible=true;return{status:'BLOCKED',reason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};};const result=await maintainIdentity(cfg,{allowRefresh:true},f.d);assert.equal(result.status,'BLOCKED');assert.equal(visible,false);assert.equal(f.state.human,false);});

test('a pending MX human gate does not delay a healthy PE health check',async()=>{const f=fixture();const events=[];let release,peObserved=false;const gate=new Promise(resolve=>release=resolve);const state=new Map();f.d.read=c=>state.get(c.market)||{};f.d.save=(c,v)=>state.set(c.market,v);f.d.verify=async c=>c.market==='MX'?{status:'INVALID',reason:'SERVER_IDENTITY_NOT_PROVEN'}:{status:'HEALTHY',snapshot:snapshot(),proof:snapshot().proof};f.d.refresh=async(_c,_env,options)=>{options.onHuman();await gate;return{status:'HUMAN_REQUIRED',reason:'CAPTCHA_REQUIRED'};};const running=runCycle({markets:['MX','PE'],allowRefresh:true,onProgress:r=>{events.push({market:r.market,status:r.status,reason:r.reason});if(r.market==='PE'&&r.status==='KEEP_ALIVE_OK')peObserved=true;}},f.d);try{await new Promise(resolve=>setTimeout(resolve,1000));assert.equal(peObserved,true,JSON.stringify(events));}finally{release();await running;}});
