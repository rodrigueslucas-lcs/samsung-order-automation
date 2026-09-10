const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboardModel, buildMxFeatureCoverage, buildAutomationGaps } = require('../reporters/executive-v3/dashboardModel');
const { render } = require('../reporters/executive-v3/generateExecutiveV3.cjs');

function ledger() {
  return {
    environment: 'PREQA2',
    markets: {
      MX: { officialTotal: 37, status: 'ACTIVE', results: {
        'SAM-24964': { status: 'PASS', context: 'either', evidence: 'GNB worked.', validatedAt: '2026-09-09T18:00:00.000Z' },
        'SAM-24968': { status: 'FAIL', context: 'guest', evidence: 'Facet unavailable.', validatedAt: '2026-09-09T18:05:00.000Z' },
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

test('feature coverage conserves the 37 MX official cases', () => {
  const rows = buildMxFeatureCoverage();
  const totals = rows.reduce((acc, row) => {
    acc.total += row.total;
    acc.full += row.full;
    acc.partial += row.partial;
    acc.missing += row.missing;
    return acc;
  }, { total: 0, full: 0, partial: 0, missing: 0 });
  assert.equal(totals.total, 37);
  assert.equal(totals.full + totals.partial + totals.missing, 37);
  assert.ok(rows.some(row => row.feature === 'Checkout'));
  assert.ok(rows.some(row => row.epp > 0));
});

test('automation gap queue contains only partial or missing MX cases', () => {
  const gaps = buildAutomationGaps();
  assert.ok(gaps.length > 0);
  assert.ok(gaps.every(row => row.market === 'MX'));
  assert.ok(gaps.every(row => row.coverage === 'partial' || row.coverage === 'missing'));
  assert.equal(gaps.length, 37 - buildMxFeatureCoverage().reduce((sum, row) => sum + row.full, 0));
});

test('executive v3 exposes runtime attention separately from automation gaps', () => {
  const model = buildDashboardModel({ ledger: ledger() });
  assert.equal(model.validation.attention.length, 1);
  assert.equal(model.validation.attention[0].id, 'SAM-24968');
  assert.equal(model.validation.recent.length, 2);
  assert.equal(model.validation.recent[0].id, 'SAM-24968');
  assert.ok(model.automation.gaps.every(row => !('status' in row)));
});

test('executive v3 renders authoritative PreQA2 validation without implying MX coverage is 144-wide', () => {
  const html = render(buildDashboardModel({ ledger: ledger() }));
  assert.match(html, /Samsung Automation Control Center/);
  assert.match(html, /PREQA2 AUTHORITATIVE/);
  assert.match(html, /Coverage denominator is MX official scope \(37\), not all 144 SMB cases/);
  assert.match(html, /Official PASS does not automatically mean Full automation/);
  assert.match(html, /MX Coverage by Feature/);
  assert.match(html, /Automation Gap Queue/);
  assert.match(html, /Recent Official Validation/);
  assert.match(html, /SAM-24968/);
  assert.match(html, /No fake execution metrics/);
});

test('executive v3 remains useful with no execution evidence', () => {
  const model = buildDashboardModel({ ledger: null });
  assert.equal(model.totals.official, 144);
  assert.equal(model.totals.executed, 0);
  assert.equal(model.totals.pending, 144);
  assert.equal(model.releaseHealth, 'NO EXECUTION');
  assert.equal(model.validation.attention.length, 0);
  assert.match(render(model), /MX Automation Coverage/);
  assert.match(render(model), /No timestamped official validation evidence is available yet/);
});
