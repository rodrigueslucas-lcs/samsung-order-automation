const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCoCampaignExit } = require('../../scripts/co-qst-exit-policy.cjs');
const registry = require('../known-defects.json');

function fixture() {
  const result = { status: 'failed', errors: [{
    message: "Locator: getByText('SKU-CO', { exact: true }).first()\nError: element(s) not found",
    snippet: '> 534 | await expect(page.getByText(cfg.sku,{exact:true}).first()).toBeVisible({timeout:30000});',
  }], attachments: [
    { name: 'CO Product Context', text: JSON.stringify({ market: 'CO', environment: 'S2', sku: 'SKU-CO' }) },
    { name: 'co-logout-transition', text: JSON.stringify({ logoutStatus: 302, returnStatus: 200, menuAttempts: 1 }) },
    { name: 'co-logout-registered-cart' },
    { name: 'error-context', text: '```yaml\n- heading "Su carrito está vacío" [level=2]\n```' },
  ] };
  const report = { suites: [{ specs: [{ title: 'SAM-24896 logout', tests: [{ results: [result] }] }] }], errors: [] };
  return { runtime: { market: 'CO', environment: 'S2', store: 'BASE_STORE', tests: [{ samId: 'SAM-24896', status: 'FAIL' }] },
    report, phases: [{ status: 1, report }], registry, readText: a => a?.text || '' };
}
function row(input) { return input.report.suites[0].specs[0].tests[0].results[0]; }

test('proven active CO S2 logout/cart defect is non-gating and retains technical FAIL', () => {
  const input = fixture();
  assert.deepEqual(evaluateCoCampaignExit(input), { exitCode: 0, knownDefectIds: ['SAM-24896'] });
  assert.equal(input.runtime.tests[0].status, 'FAIL');
  assert.equal(row(input).status, 'failed');
});

test('Playwright keeps source snippet in result.error rather than errors array', () => {
  const input = fixture();
  row(input).error = { ...row(input).errors[0] };
  delete row(input).errors[0].snippet;
  assert.equal(evaluateCoCampaignExit(input).exitCode, 0);
});

for (const [name, change] of [
  ['S1', x => { x.runtime.environment = 'S1'; }],
  ['another market', x => { x.runtime.market = 'PE'; }],
  ['closed defect', x => { x.registry = { defects: registry.defects.map(d => ({ ...d, status: 'CLOSED' })) }; }],
  ['missing logout proof', x => { row(x).attachments = row(x).attachments.filter(a => a.name !== 'co-logout-transition'); }],
  ['failed logout', x => { row(x).attachments[1].text = JSON.stringify({ logoutStatus: 502, returnStatus: 200, menuAttempts: 1 }); }],
  ['missing registered-cart proof', x => { row(x).attachments = row(x).attachments.filter(a => a.name !== 'co-logout-registered-cart'); }],
  ['non-empty cart', x => { row(x).attachments.at(-1).text = '```yaml\n- heading "Carrito"\n```'; }],
  ['missing snapshot file', x => { x.readText = () => { throw Error('ENOENT'); }; }],
  ['auth failure', x => { row(x).errors[0].message = 'Auth session expired'; }],
  ['another assertion', x => { row(x).errors[0].snippet = '> 1 | await expect(logout).toBeVisible();'; }],
  ['whole-test timeout', x => { row(x).status = 'timedOut'; }],
  ['additional error', x => { row(x).errors.push({ message: 'network error' }); }],
  ['global runner error', x => { x.report.errors.push({ message: 'worker crashed' }); }],
  ['unhealthy auth gate in targeted run', x => { x.targeted = true; x.sessionGateFailed = true; }],
  ['process crash', x => { x.phases[0].status = 2; }],
  ['process signal', x => { x.phases[0].signal = 'SIGTERM'; }],
  ['spawn failure', x => { x.phases[0].error = Error('spawn failed'); }],
  ['missing phase report', x => { x.phases[0].report = null; }],
  ['unexpected TC failure', x => { x.report.suites[0].specs.push({ title: 'SAM-24919 Track', tests: [{ results: [{ status: 'failed', errors: [{ message: 'timeout' }] }] }] }); }],
  ['missing official execution', x => { x.runtime.tests.push({ samId: 'SAM-24919', status: 'NOT_RUN' }); }],
]) test(`CO exit policy preserves failure: ${name}`, () => {
  const input = fixture(); change(input);
  assert.equal(evaluateCoCampaignExit(input).exitCode, 1);
});

test('targeted omitted TCs are allowed, but a nonzero process without a failed TC is not', () => {
  const input = fixture();
  input.targeted = true;
  input.runtime.tests.push({ samId: 'SAM-24919', status: 'NOT_RUN' });
  assert.equal(evaluateCoCampaignExit(input).exitCode, 0);
  row(input).status = 'passed';
  input.runtime.tests[0].status = 'PASS';
  assert.equal(evaluateCoCampaignExit(input).exitCode, 1);
  input.phases[0].status = 0;
  assert.equal(evaluateCoCampaignExit(input).exitCode, 0);
});
