const {test}=require('node:test');const assert=require('node:assert/strict');
const {getEppConfig,getEppPrograms}=require('../../config/markets/epp');const {getEppSessionPaths}=require('../../utils/eppSession.cjs');const {bundlePath,maintainIdentity}=require('../../utils/eppKeepAlive.cjs');const {getEppRuntimeData}=require('../../utils/eppRuntimeData.cjs');const {classifyProgramObservation}=require('../../utils/eppProgramAccess.cjs');

test('SDS PE S2 reference preserves distinct baseSite/store route, staging guard and existing default',()=>{
 const cfg=getEppConfig('PE',{ENVIRONMENT:'S2',EPP_PROGRAM:'ventaestudiantes'}),vip=getEppConfig('PE',{ENVIRONMENT:'S2'});
 assert.equal(vip.program,'pe_membership_vip');
 assert.equal(cfg.rootUrl.href,'https://stg2.shop.samsung.com/pe/multistore/peeppmulti/ventaestudiantes/');
 assert.equal(cfg.sku,'QN65QN800DGXPE');assert.equal(cfg.pdpUrl.href,cfg.rootUrl.href+'p/QN65QN800DGXPE');
 assert.equal(cfg.apiSite,'ventaestudiantes');
 assert.equal(cfg.programPolicy.allowAutomaticRetry,false);assert.equal(cfg.verificationCode,null);
 assert.notEqual(getEppSessionPaths(cfg).state,getEppSessionPaths(vip).state);
 assert.throws(()=>getEppConfig('PE',{ENVIRONMENT:'S1',EPP_PROGRAM:'ventaestudiantes'}),/Unknown/);
 assert.throws(()=>getEppConfig('PE',{ENVIRONMENT:'S2',EPP_PROGRAM:'ventaestudiantes',PE_EPP_STOREFRONT_URL:'https://www.samsung.com/pe/multistore/peeppmulti/ventaestudiantes/'}),/staging/);
 const overridden=getEppConfig('PE',{ENVIRONMENT:'S2',EPP_PROGRAM:'ventaestudiantes',PE_EPP_QST_SKU:'RB45DG6300B1PE',PE_EPP_QST_PDP_URL:cfg.rootUrl.href+'p/RB45DG6300B1PE'});
 assert.equal(overridden.sku,'RB45DG6300B1PE');
});

test('documented CL payment programmes are opt-in, isolated and preserve alianzas default',()=>{
 for(const environment of ['S1','S2']){
  const base=getEppConfig('CL',{ENVIRONMENT:environment});assert.equal(base.program,'alianzas');
  for(const program of ['colaboradores','ventab2b_cl']){
   const cfg=getEppConfig('CL',{ENVIRONMENT:environment,EPP_PROGRAM:program});
   assert.equal(cfg.rootUrl.pathname,`/cl/multistore/${program}/${program}/`);
   assert.equal(cfg.programPolicy.allowAutomaticRetry,false);
   assert.notEqual(getEppSessionPaths(cfg).state,getEppSessionPaths(base).state);
   assert.equal(cfg.verificationCode,null);assert.equal(cfg.sku,null);
  }
 }
});
test('CO programme priority excludes the broken Production callback without erasing legacy config',()=>{const p=getEppPrograms('CO');assert.deepEqual(p.map(p=>p.id),['alianzas_co','estudiantes_co','co_epp_agre']);assert.equal(p[2].allowAutomaticRetry,false);assert.equal(p[2].knownStatus,'BLOCKED_CALLBACK_TO_PRODUCTION');assert.equal(getEppConfig('CO',{}).program,'alianzas_co');});
test('programme namespaces preserve legacy paths and independently isolate profiles, slots and bundles',()=>{const old=getEppConfig('CO',{EPP_PROGRAM:'co_epp_agre'}),a=getEppConfig('CO',{EPP_PROGRAM:'alianzas_co'}),b=getEppConfig('CO',{EPP_PROGRAM:'estudiantes_co'}),second=getEppConfig('CO',{EPP_PROGRAM:'alianzas_co',EPP_AUTH_SLOT:'second'});for(const key of ['directory','profile','state','metadata','handoff']){assert.notEqual(getEppSessionPaths(old)[key],getEppSessionPaths(a)[key]);assert.notEqual(getEppSessionPaths(a)[key],getEppSessionPaths(b)[key]);assert.notEqual(getEppSessionPaths(a)[key],getEppSessionPaths(second)[key]);}assert.notEqual(bundlePath(a),bundlePath(b));assert.equal(a.sku,null);assert.equal(a.pdpUrl,null);});
test('only registered PE alternate canonical paths are accepted, never arbitrary nonmultistore or Production',()=>{for(const id of ['pe_centelec','pe_membership_vip']){const c=getEppConfig('PE',{EPP_PROGRAM:id});assert.equal(c.rootUrl.pathname,id==='pe_centelec'?`/pe/${id}/${id}/`:`/pe/multistore/${id}/${id}/`);assert.equal(c.verificationCode,null);assert.equal(c.programPolicy.allowAutomaticRetry,id==='pe_membership_vip');}assert.throws(()=>getEppConfig('PE',{EPP_PROGRAM:'other'}),/Unknown/);assert.throws(()=>getEppConfig('PE',{PE_EPP_STOREFRONT_URL:'https://stg2.shop.samsung.com/pe/other/other/'}));assert.throws(()=>getEppConfig('PE',{EPP_PROGRAM:'pe_centelec',PE_EPP_STOREFRONT_URL:'https://www.samsung.com/pe/'}),/staging/);assert.throws(()=>getEppConfig('CO',{EPP_PROGRAM:'alianzas_co',CO_EPP_STOREFRONT_URL:getEppConfig('CO',{EPP_PROGRAM:'co_epp_agre'}).rootUrl.href}),/another programme/);});
test('registered URL overrides select the same programme namespace rather than overwriting legacy state',()=>{const a=getEppConfig('CO',{EPP_PROGRAM:'alianzas_co'}),b=getEppConfig('CO',{CO_EPP_STOREFRONT_URL:a.rootUrl.href});assert.equal(b.program,a.program);assert.equal(b.programNamespace,a.programNamespace);});
test('programme data never inherits another programme product or contact',()=>{const c=getEppConfig('CO',{EPP_PROGRAM:'alianzas_co'}),io={existsSync:()=>true,readFileSync:()=>JSON.stringify({S2:{CO:{product:{sku:'legacy'},programs:{alianzas_co:{product:{sku:'scoped'}}}}}})};assert.equal(getEppRuntimeData(c,io).product.sku,'scoped');assert.equal(getEppRuntimeData({...c,programNamespace:'estudiantes_co'},io),null);});
test('known blocked programme never verifies, logs in, captures a window or publishes automatically',async()=>{const c=getEppConfig('CO',{EPP_PROGRAM:'co_epp_agre'});const r=await maintainIdentity(c,{allowRefresh:true,publish:true},{acquire:()=>assert.fail('must not acquire blocked programme')});assert.equal(r.reason,'BLOCKED_CALLBACK_TO_PRODUCTION');assert.equal(r.loginAttempts,0);});
test('checkAccess and visible storefront without identity cannot create EPP healthy proof',()=>{const c=getEppConfig('PE',{EPP_PROGRAM:'pe_centelec'});const r=classifyProgramObservation(c,{proof:{userAccepted:false,accessAccepted:true},ui:{status:'READY'},bodyLength:80});assert.equal(r.health,'BLOCKED');assert.equal(r.identity,'UNKNOWN');assert.equal(r.entitlement,'VALID');assert.equal(r.financialSubmits,0);});
test('400 callback is recoverable only with causal identity plus entitlement plus storefront proof',()=>{const c=getEppConfig('CO',{EPP_PROGRAM:'estudiantes_co'});const r=classifyProgramObservation(c,{proof:{userAccepted:true,accessAccepted:true},ui:{status:'READY'},bodyLength:90,callbackStatus:'BROKEN_400'});assert.equal(r.health,'HEALTHY');assert.equal(r.action,'RECOVER_CANONICAL_URL');assert.equal(r.callbackStatus,'BROKEN_400');assert.equal(r.retries,0);const blocked=classifyProgramObservation(c,{proof:{userAccepted:true,accessAccepted:false},ui:{status:'READY'},bodyLength:90,callbackStatus:'BROKEN_400'});assert.equal(blocked.health,'BLOCKED');});
test('empty Yape DOM remains a render/entitlement blocker even when Account identity is accepted',()=>{const c=getEppConfig('PE',{EPP_PROGRAM:'pe_yape'}),r=classifyProgramObservation(c,{proof:{userAccepted:true,accessAccepted:true},ui:{status:'BLOCKED'},bodyLength:0});assert.equal(r.reason,'ENTITLEMENT_OR_STOREFRONT_RENDER_BLOCKED');assert.equal(r.health,'BLOCKED');});

test('programme reporting never shares a CO proof across programmes or promotes a greeting alone',()=>{
 const {eppView}=require('../../reporting/auth-operations/epp.cjs'),now=Date.now();const row={store:'EPP',market:'CO',environment:'S2',slot:'primary',program:'alianzas_co',observedAt:new Date(now).toISOString(),proof:{userAccepted:true,accessAccepted:true},storefront:'OK'};
 const result=eppView(null,'S2',now,{}, {},{'CO:alianzas_co':row});assert.equal(result.sessions.find(r=>r.program==='alianzas_co').health,'HEALTHY');assert.notEqual(result.sessions.find(r=>r.program==='estudiantes_co').health,'HEALTHY');assert.equal(result.sessions.find(r=>r.program==='co_epp_agre').reason,'BLOCKED_CALLBACK_TO_PRODUCTION');
 row.proof={userAccepted:false,accessAccepted:true};assert.notEqual(eppView(null,'S2',now,{}, {},{'CO:alianzas_co':row}).sessions.find(r=>r.program==='alianzas_co').health,'HEALTHY');
});

test('accepted server proof with missing storefront reports the UI blocker, never SERVER_ACCEPTED as a failure reason',()=>{const r=classifyProgramObservation(getEppConfig('CO',{EPP_PROGRAM:'alianzas_co'}),{proof:{userAccepted:true,accessAccepted:true,reason:'SERVER_ACCEPTED'},ui:{status:'BLOCKED',reason:'COMMERCE_CONTENT_NOT_RENDERED'},bodyLength:10});assert.equal(r.health,'BLOCKED');assert.equal(r.reason,'COMMERCE_CONTENT_NOT_RENDERED');});

test('same-market EPP identity seeds never cross FIRST/SECOND or constitute target entitlement proof',()=>{const s=require('../../utils/eppSession.cjs'),seen=[],cfg=getEppConfig('CO',{EPP_PROGRAM:'estudiantes_co',EPP_AUTH_SLOT:'second'});const r=s.loadEppProgramSeed(cfg,{load:c=>{seen.push(c);return {storageState:{cookies:c.program==='alianzas_co'?[{name:'fixture'}]:[],origins:[]},sessionStorage:{}};}});assert.equal(r.sourceProgram,'alianzas_co');assert.ok(seen.every(c=>c.authSlot==='second'&&c.market==='CO'&&c.environment==='S2'));assert.equal(r.snapshot.proof,undefined);});
