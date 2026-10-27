const test = require('node:test');
const assert = require('node:assert/strict');
const { inventory, extractResults, buildRows } = require('../../scripts/report-epp-homologation.cjs');
test('EPP matrix represents 26 unique official cases and 52 environment rows without inventing runtime PASS', () => {
  const scope = inventory();
  assert.equal(scope.length,26);
  assert.equal(new Set(scope.map(r=>`${r.market}:${r.tc}`)).size,26);
  const rows = buildRows(scope);
  assert.equal(rows.length,52);
  assert.ok(rows.every(r=>r.result==='NOT_RUN'));
  assert.equal(scope.filter(r=>r.implementation==='BLOCKED_NOT_IMPLEMENTED').length,8);
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
