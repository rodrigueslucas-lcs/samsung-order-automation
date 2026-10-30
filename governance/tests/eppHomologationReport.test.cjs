const test = require('node:test');
const assert = require('node:assert/strict');
const { inventory, extractResults, buildRows, prerequisiteReason, mergeObservation } = require('../../scripts/report-epp-homologation.cjs');
const {classifyObservation}=require('../../scripts/report-epp-homologation.cjs');
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
  assert.equal(scope.filter(r=>r.implementation==='PREREQUISITE_FLOW').length,5);
  assert.equal(scope.filter(r=>r.implementation==='IMPLEMENTED').length,21);
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
test('matrix preserves actionable blocker categories without copying sensitive descriptions', () => {
  assert.equal(prerequisiteReason('PAYMENT_FLOW_NOT_PROVEN: AMBIGUOUS_EPP_ORDER_ATTEMPT requires reconciliation'),'AMBIGUOUS_EPP_ORDER_ATTEMPT');
  assert.equal(prerequisiteReason('BLOCKED: contact QA data is missing'),'MISSING_EPP_CONTACT_DATA');
  assert.equal(prerequisiteReason('BLOCKED_NOT_IMPLEMENTED: card flow'),'PAYMENT_ADAPTER_NOT_IMPLEMENTED');
  assert.equal(prerequisiteReason('unrecognized sensitive fixture data'),'PREREQUISITE_NOT_MET');
});
test('a prerequisite block cannot erase a proven PASS, and remains visible as current state', () => {
  const pass = { tc:'SAM-25022', result:'PASS', runtime:'TARGETED_RUNTIME', notes:'EXPECTED_BEHAVIOR_PROVEN' };
  const block = { tc:'SAM-25022', result:'BLOCKED', runtime:'PREREQUISITE_CHECK', notes:'AUTH_OR_ENTITLEMENT_REQUIRED' };
  const merged = mergeObservation(pass,block);
  assert.equal(merged.result,'PASS');
  assert.equal(merged.runtime,'HISTORICAL_TARGETED_RUNTIME');
  assert.equal(merged.latestAttempt.result,'BLOCKED');
  assert.match(merged.notes,/CURRENT_AUTH_OR_ENTITLEMENT_REQUIRED/);
  const fail = { tc:'SAM-25022', result:'FAIL', runtime:'TARGETED_RUNTIME', notes:'INSPECT_IGNORED_PLAYWRIGHT_REPORT' };
  assert.deepEqual(mergeObservation(pass,fail),fail);
  assert.deepEqual(mergeObservation(fail,pass),pass);
});
