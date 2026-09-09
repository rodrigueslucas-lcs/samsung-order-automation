const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboardModel } = require('../reporters/executive-v3/dashboardModel');
const { render } = require('../reporters/executive-v3/generateExecutiveV3.cjs');

function ledger() {
  return {
    environment: 'PREQA2',
    markets: {
      MX: { officialTotal: 37, status: 'ACTIVE', results: {
        'SAM-24964': { status: 'PASS', context: 'either', evidence: 'GNB worked.' },
        'SAM-24968': { status: 'FAIL', context: 'guest', evidence: 'Facet unavailable.' },
      }},
      CL: { officialTotal: 38, status: 'NOT_STARTED', results: {} },
      CO: { officialTotal: 35, status: 'NOT_STARTED', results: {} },
      PE: { officialTotal: 34, status: 'NOT_STARTED', results: {} },
    },
  };
}

test('executive v3 keeps 144 official scope and separates official execution from MX automation', () => {
  const model = buildDashboardModel({ ledger: ledger() });
  assert.equal(model.totals.official, 144);
  assert.equal(model.totals.executed, 2);
  assert.equal(model.totals.pass, 1);
  assert.equal(model.totals.fail, 1);
  assert.equal(model.totals.pending, 142);
  assert.equal(model.automation.scope, 'MX');
  assert.equal(model.automation.official, 37);
  assert.equal(model.automation.full + model.automation.partial + model.automation.missing, 37);
});

test('executive v3 renders authoritative PreQA2 validation without implying MX coverage is 144-wide', () => {
  const html = render(buildDashboardModel({ ledger: ledger() }));
  assert.match(html, /Samsung Automation Control Center/);
  assert.match(html, /PREQA2 AUTHORITATIVE/);
  assert.match(html, /Coverage denominator is MX official scope \(37\), not all 144 SMB cases/);
  assert.match(html, /Official PASS does not automatically mean Full automation/);
  assert.match(html, /No fake execution metrics/);
});

test('executive v3 remains useful with no execution evidence', () => {
  const model = buildDashboardModel({ ledger: null });
  assert.equal(model.totals.official, 144);
  assert.equal(model.totals.executed, 0);
  assert.equal(model.totals.pending, 144);
  assert.equal(model.releaseHealth, 'NO EXECUTION');
  assert.match(render(model), /MX Automation Coverage/);
});
