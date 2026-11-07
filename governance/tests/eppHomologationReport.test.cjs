const test = require('node:test');
const assert = require('node:assert/strict');
const { inventory, extractResults, buildRows, prerequisiteReason, mergeObservation } = require('../../scripts/report-epp-homologation.cjs');
const {classifyObservation}=require('../../scripts/report-epp-homologation.cjs');
test('explicit missing tooltip prerequisite remains a data dependency in reporting',()=>{
  const notes=prerequisiteReason('MASS_REQUIRED: configured CO EPP cart has no tooltip trigger');
  assert.equal(notes,'MASS_REQUIRED');
  assert.equal(classifyObservation({result:'BLOCKED',notes}).classification,'MASS_REQUIRED');
});
test('triage distinguishes fixable unknowns from proven external prerequisites without changing outcomes',()=>{
 for(const [notes,classification]of [['MISSING_EPP_CONTACT_DATA','MASS_REQUIRED'],['CORPORATE_ACTIVATION_REQUIRED','ACCESS_REQUIRED'],['HUMAN_REQUIRED','HUMAN_REQUIRED'],['MISSING_EXPECTED_CART_FOOTER','APPLICATION_BUG'],['PRODUCTION_NAVIGATION_BLOCKED','ENVIRONMENT_BLOCKER'],['PAYMENT_FLOW_NOT_PROVEN','AUTOMATION_FIXABLE']])assert.equal(classifyObservation({result:'BLOCKED',notes}).classification,classification);
 assert.equal(classifyObservation({result:'PASS',notes:'EXPECTED_BEHAVIOR_PROVEN'}).classification,'');
 assert.equal(prerequisiteReason('EPP_IDENTITY_REQUIRED: sensitive details suppressed'),'EPP_IDENTITY_REQUIRED');
});
test('EPP matrix represents 26 unique official cases and 52 environment rows without inventing runtime PASS', () => {
  const scope = inventory();
  assert.equal(scope.length,26);
  assert.equal(new Set(scope.map(r=>`${r.market}:${r.tc}`)).size,26);
  const rows = buildRows(scope);
  assert.equal(rows.length,52);
  assert.ok(rows.every(r=>r.result==='NOT_RUN'));
  assert.equal(scope.filter(r=>r.implementation==='PREREQUISITE_FLOW').length,1);
  assert.equal(scope.filter(r=>r.implementation==='IMPLEMENTED').length,25);
  assert.equal(scope.filter(r=>r.market==='CL').length,7);
  assert.ok(scope.filter(r=>r.market==='CL').every(r=>r.implementation==='IMPLEMENTED'));
  assert.equal(scope.filter(r=>r.implementation==='BLOCKED_NOT_IMPLEMENTED').length,0);
  assert.equal(scope.filter(r=>r.implementation==='PARTIAL').length,0);
});
test('EPP report uses actual result and omits raw failure, account or provider data', () => {
  const raw = { suites: [{ specs: [
    { title: 'SAM-25022 Cart', tests: [{ results: [{ status: 'failed', error: { message: 'sensitive fixture data' } }] }] },
    { title: 'SAM-25020 Filter', tests: [{ annotations: [{ type: 'skip', description: 'BLOCKED: identity required' }], results: [{ status: 'skipped' }] }] },
  ] }] };
  const results = extractResults(raw);
  assert.deepEqual(results.map(r=>r.result),['FAIL','BLOCKED']);
  assert.ok(!JSON.stringify(results).includes('sensitive fixture data'));
  assert.equal(buildRows([{market:'MX',tc:'SAM-25022',implementation:'IMPLEMENTED'}],new Map([['MX:S2:SAM-25022',results[0]]]))[0].result,'NOT_RUN');
});
test('successful explicit recovery is not a new functional payment PASS',()=>{
 const rows=extractResults({suites:[{specs:[{title:'SAM-24864 Card',tests:[{annotations:[{type:'epp-execution-mode',description:'RECOVERY_ONLY'}],results:[{status:'passed'}]}]}]}]});
 assert.equal(rows[0].runtime,'RECOVERY_ONLY');assert.equal(rows[0].result,'NOT_RUN');
 assert.equal(rows[0].notes,'READ_ONLY_RECOVERY_NOT_FUNCTIONAL_HOMOLOGATION');
});
test('typed empty-footer failure remains an observed application defect, not a login failure',()=>{
 const rows=extractResults({suites:[{specs:[{title:'SAM-24841 Cart UI',tests:[{results:[{status:'failed',error:{message:'ENVIRONMENT_DEFECT: MISSING_EXPECTED_CART_FOOTER; known defect SAM-25146.'}}]}]}]}]});
 assert.equal(rows[0].result,'FAIL');assert.equal(rows[0].notes,'MISSING_EXPECTED_CART_FOOTER');
 assert.equal(classifyObservation(rows[0]).classification,'APPLICATION_BUG');
});
test('matrix preserves actionable blocker categories without copying sensitive descriptions', () => {
  assert.equal(prerequisiteReason('PAYMENT_FLOW_NOT_PROVEN: AMBIGUOUS_EPP_ORDER_ATTEMPT requires reconciliation'),'AMBIGUOUS_EPP_ORDER_ATTEMPT');
  assert.equal(prerequisiteReason('BLOCKED: contact QA data is missing'),'MISSING_EPP_CONTACT_DATA');
  assert.equal(prerequisiteReason('BLOCKED_NOT_IMPLEMENTED: card flow'),'PAYMENT_ADAPTER_NOT_IMPLEMENTED');
  assert.equal(prerequisiteReason('unrecognized sensitive fixture data'),'PREREQUISITE_NOT_MET');
});
test('latest status drives counts while historical PASS remains independently visible', () => {
  const pass = { tc:'SAM-25022', result:'PASS', runtime:'TARGETED_RUNTIME', notes:'EXPECTED_BEHAVIOR_PROVEN' };
  const block = { tc:'SAM-25022', result:'BLOCKED', runtime:'PREREQUISITE_CHECK', notes:'AUTH_OR_ENTITLEMENT_REQUIRED' };
  const merged = mergeObservation(pass,block);
  assert.equal(merged.result,'BLOCKED');
  assert.equal(merged.runtime,'PREREQUISITE_CHECK');
  assert.equal(merged.historicalPass.result,'PASS');
  assert.equal(merged.notes,'AUTH_OR_ENTITLEMENT_REQUIRED');
  const fail = { tc:'SAM-25022', result:'FAIL', runtime:'TARGETED_RUNTIME', notes:'INSPECT_IGNORED_PLAYWRIGHT_REPORT' };
  assert.equal(mergeObservation(pass,fail).result,'FAIL');
  assert.equal(mergeObservation(pass,fail).historicalPass.result,'PASS');
  assert.equal(mergeObservation(merged,fail).historicalPass.result,'PASS');
  assert.deepEqual(mergeObservation(fail,pass),pass);
});

test('read-only recovery cannot replace the latest functional verdict',()=>{
 const failed={tc:'SAM-24865',result:'FAIL',runtime:'TARGETED_RUNTIME',notes:'AMBIGUOUS_EPP_ORDER_ATTEMPT'};
 const recovery={tc:'SAM-24865',result:'NOT_RUN',runtime:'RECOVERY_ONLY',notes:'READ_ONLY_RECOVERY_NOT_FUNCTIONAL_HOMOLOGATION'};
 const merged=mergeObservation(failed,recovery);
 assert.equal(merged.result,'FAIL');assert.equal(merged.latestRecovery.runtime,'RECOVERY_ONLY');
 assert.deepEqual(mergeObservation(undefined,recovery),recovery);
});

test('ambiguous financial initiation keeps FAIL while exposing only its safe reconciliation reason',()=>{const rows=extractResults({suites:[{specs:[{title:'SAM-25045 Card',tests:[{results:[{status:'failed',error:{message:'AMBIGUOUS_EPP_ORDER_ATTEMPT: private details must not be copied'}}]}]}]}]});assert.equal(rows[0].result,'FAIL');assert.equal(rows[0].notes,'AMBIGUOUS_EPP_ORDER_ATTEMPT');assert.equal(classifyObservation(rows[0]).classification,'ACCESS_REQUIRED');assert.ok(!JSON.stringify(rows).includes('private details'));});

test('confirmation is a dependency block only when the same campaign payment was explicitly blocked',()=>{const document=status=>({suites:[{specs:[{title:'SAM-25138 Card',tests:[{annotations:[{type:'skip',description:'AUTH_OR_ENTITLEMENT_REQUIRED: no identity'}],results:[{status}]}]},{title:'SAM-25140 Confirmation',tests:[{results:[{status:'failed',error:{message:'Error: CURRENT_RUN_ORDER_REQUIRED: no causal order'}}]}]}]}]});const blocked=extractResults(document('skipped'));assert.equal(blocked[1].result,'BLOCKED');assert.equal(blocked[1].notes,'AUTH_OR_ENTITLEMENT_REQUIRED');assert.equal(extractResults(document('failed'))[1].result,'FAIL');assert.equal(extractResults(document('passed'))[1].result,'FAIL');});
