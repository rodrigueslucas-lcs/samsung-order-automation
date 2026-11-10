const test=require('node:test'),assert=require('node:assert/strict');
const {activeKnownDefects}=require('../../scripts/annotate-known-defects-dashboard.cjs');
const registry=require('../../governance/known-defects.json');
for(const scenario of [
 {market:'CO',samId:'SAM-24952',jira:'RT-746043',error:'Official EPP expected result requires Back to Top behind the visible tooltip: {"overlap":true,"tooltipOnTop":false}'},
 {market:'CL',samId:'SAM-24865',jira:'SAM-25161',error:'CL_EPP_BANK_FORBIDDEN_403'},
]){
 const runtime={market:scenario.market,environment:'S2',store:'EPP',tests:[{samId:scenario.samId,status:'FAIL',error:scenario.error}]};
 test(scenario.samId+' exposes its operator-linked Jira only for the causal signature',()=>{
  const active=activeKnownDefects(runtime,registry);assert.equal(active.length,1);assert.equal(active[0].defect.jira,scenario.jira);
  assert.equal(active[0].defect.url,'https://jira.secext.samsung.net/browse/'+scenario.jira);
  for(const error of ['TimeoutError','MASS_REQUIRED: no tooltip trigger','CL_EPP_BANK_SINGLE_SUBMIT_UNCONFIRMED','AUTH_OR_ENTITLEMENT_REQUIRED'])
   assert.equal(activeKnownDefects({...runtime,tests:[{samId:scenario.samId,status:'FAIL',error}]},registry).length,0);
  for(const change of [{market:'PE'},{environment:'S1'},{store:'BASE_STORE'},{tests:[{samId:scenario.samId,status:'PASS',error:scenario.error}]}])
   assert.equal(activeKnownDefects({...runtime,...change},registry).length,0);
 });
}

const {classify}=require('../epp-quality/model.cjs');
test('CO missing tooltip with current cart evidence matches the operator-confirmed issue only in its programme',()=>{const x={market:'CO',program:'co_epp_agre',tc:'SAM-24952',raw:'skipped',reason:'CO_EPP_TOOLTIP_MISSING_RT746043 co_epp_agre',evidence:[{path:'cart.png'}]};assert.equal(classify(x).reference,'RT-746043');assert.equal(classify({...x,evidence:[]}).quality,'NOT_RUN');assert.equal(classify({...x,program:'other'}).quality,'NOT_RUN');for(const reason of ['TimeoutError','AUTH_OR_ENTITLEMENT_REQUIRED','MASS_REQUIRED: no product'])assert.notEqual(classify({...x,reason}).quality,'KNOWN_DEFECT');});
