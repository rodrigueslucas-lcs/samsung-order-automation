const test=require('node:test'),assert=require('node:assert/strict');
const {getEppConfig}=require('../../config/markets/epp');
const {manualProgrammeRevalidation}=require('../../scripts/auth-refresh-epp.cjs');
test('only explicit manual CO S2 FIRST co_epp_agre revalidation is allowed',()=>{
 const actual=getEppConfig('CO',{ENVIRONMENT:'S2',EPP_PROGRAM:'co_epp_agre'}),cfg={...actual,programPolicy:{...actual.programPolicy,allowAutomaticRetry:false,knownStatus:'BLOCKED_CALLBACK_TO_PRODUCTION'}},args=['--revalidate-observed-program'];
 assert.equal(manualProgrammeRevalidation(cfg,args,{}),true);
 assert.equal(cfg.programPolicy.allowAutomaticRetry,false);
 assert.equal(manualProgrammeRevalidation(cfg,[],{}),false);
 for(const change of [{market:'PE'},{environment:'S1'},{authSlot:'second'},{program:'alianzas_co'},{rootUrl:new URL('https://www.samsung.com/co/multistore/co_epp_agre/co_epp_agre/')}])assert.equal(manualProgrammeRevalidation({...cfg,...change},args,{}),false);
 assert.equal(manualProgrammeRevalidation(cfg,args,{EPP_AUTH_MAINTENANCE:'1'}),false);
});
test('CO legacy uses same-profile staging identity entry without changing entitlement policy',()=>{const cfg=getEppConfig('CO',{ENVIRONMENT:'S2',EPP_PROGRAM:'co_epp_agre'});assert.equal(cfg.identityEntryUrl.href,'https://stg2.shop.samsung.com/co/');assert.equal(cfg.rootUrl.pathname,'/co/multistore/co_epp_agre/co_epp_agre/');assert.equal(cfg.programPolicy.allowAutomaticRetry,true);assert.equal(getEppConfig('CO',{ENVIRONMENT:'S1'}).identityEntryUrl,null);});
