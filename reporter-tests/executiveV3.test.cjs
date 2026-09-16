const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDashboardModel,
  buildMxFeatureCoverage,
  buildAutomationGaps,
  buildCaseCatalog,
  buildEnvironmentHandoffs,
  buildMarketFeatureMatrix,
  buildTrend,
  buildConsistencyAudit,
} = require('../reporters/executive-v3/dashboardModel');
const { render, evidenceHref } = require('../reporters/executive-v3/generateExecutiveV3.cjs');

function ledger() {
  return { environment: 'PREQA2', markets: {
    MX: { officialTotal: 37, status: 'ACTIVE', results: {
      'SAM-24964': { status: 'PASS', context: 'either', evidence: 'GNB worked.', validatedAt: '2026-09-09T18:00:00.000Z' },
      'SAM-24968': { status: 'FAIL', context: 'guest', evidence: 'Facet unavailable.', validatedAt: '2026-09-09T18:05:00.000Z' },
    }},
    CL: { officialTotal: 38, status: 'NOT_STARTED', results: {} },
    CO: { officialTotal: 35, status: 'NOT_STARTED', results: {} },
    PE: { officialTotal: 34, status: 'NOT_STARTED', results: {} },
  }};
}

function routedLedger() {
  const value = ledger();
  value.markets.MX.results['SAM-24971'] = { status: 'NOT_APPLICABLE', context: 'either', validationEnvironment: 'PREQA2', targetEnvironment: 'STAGING', environmentReason: 'Cart redirects to staging and is not a PreQA storefront flow.' };
  return value;
}

function build5Execution() {
  const statuses = [
    ...Array(14).fill('PASS'), ...Array(8).fill('FAIL'), ...Array(8).fill('SKIPPED-BLOCKED'),
  ];
  return {
    buildNumber: '5', buildUrl: 'http://localhost:8080/job/SAMSUNG-SMB-AUTOMATION/5/', gitCommit: 'abc123', timestamp: '2026-09-15T18:26:00.000Z',
    market: 'MX', store: 'BASE_STORE', suite: 'P1/QST', environment: 'S1/STG',
    summary: { official: 30, executed: 22, passed: 14, failed: 8, blocked: 8, notRun: 0, passRate: 63.636, duration: 2262000 },
    tests: statuses.map((status, index) => ({ samId: `SAM-${25000 + index}`, title: `Fixture ${index + 1}`, status, duration: 1000, attachments: index === 0 ? [{ name: 'screenshot', path: 'test-results/jenkins/mx-qst/playwright/example/test-failed-1.png' }] : [] })),
  };
}

test('executive keeps canonical 144 scope separate from MX automation coverage', () => {
  const model = buildDashboardModel({ ledger: ledger() });
  assert.equal(model.totals.official, 144);
  assert.equal(model.totals.executed, 2);
  assert.equal(model.automation.official, 37);
  assert.equal(model.automation.full + model.automation.partial + model.automation.missing, 37);
});

test('feature coverage conserves the 37 MX official cases', () => {
  const rows = buildMxFeatureCoverage();
  const totals = rows.reduce((acc, row) => ({ total: acc.total + row.total, full: acc.full + row.full, partial: acc.partial + row.partial, missing: acc.missing + row.missing }), { total: 0, full: 0, partial: 0, missing: 0 });
  assert.equal(totals.total, 37);
  assert.equal(totals.full + totals.partial + totals.missing, 37);
});

test('automation gap queue contains only partial or missing MX cases', () => {
  const gaps = buildAutomationGaps();
  assert.ok(gaps.length > 0);
  assert.ok(gaps.every(row => row.market === 'MX' && (row.coverage === 'partial' || row.coverage === 'missing')));
});

test('TC catalog always contains exactly the 144 canonical IDs', () => {
  const catalog = buildCaseCatalog(ledger());
  assert.equal(catalog.length, 144);
  assert.equal(catalog.filter(row => row.market === 'MX').length, 37);
  assert.equal(catalog.filter(row => row.status === 'NOT_RUN').length, 142);
});

test('N/A in PreQA is modeled as an environment handoff, not a pass', () => {
  const handoffs = buildEnvironmentHandoffs(buildCaseCatalog(routedLedger()));
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0].id, 'SAM-24971');
  assert.equal(handoffs[0].toEnvironment, 'STAGING');
});

test('Market x Feature matrix conserves all catalog rows', () => {
  const catalog = buildCaseCatalog(ledger());
  const matrix = buildMarketFeatureMatrix(catalog);
  for (const market of ['MX', 'CL', 'CO', 'PE']) assert.equal(matrix.reduce((total, row) => total + row.markets[market].total, 0), catalog.filter(row => row.market === market).length);
});

test('trend uses supplied snapshots without inventing history', () => {
  const historical = ledger();
  historical.markets.MX.results = { 'SAM-24964': historical.markets.MX.results['SAM-24964'] };
  const rows = buildTrend([{ label: 'Earlier', ledger: historical }], ledger());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].executed, 1);
  assert.equal(rows[1].executed, 2);
});

test('consistency audit flags unknown ledger IDs', () => {
  assert.equal(buildConsistencyAudit(ledger()).ok, true);
  const badLedger = ledger();
  badLedger.markets.MX.results['SAM-99999'] = { status: 'PASS' };
  assert.equal(buildConsistencyAudit(badLedger).ok, false);
});

test('Build #5 runtime reconciles 30 = 14 PASS + 8 FAIL + 8 BLOCKED + 0 NOT_RUN', () => {
  const execution = build5Execution();
  const s = execution.summary;
  assert.equal(s.passed + s.failed + s.blocked + s.notRun, s.official);
  assert.equal(s.official, 30);
  assert.equal(s.passed, 14);
  assert.equal(s.failed, 8);
  assert.equal(s.blocked, 8);
  assert.equal(s.notRun, 0);
});

test('Current Build Runtime denominator remains 30 even when canonical MX coverage is 37', () => {
  const model = buildDashboardModel({ ledger: ledger(), execution: build5Execution() });
  assert.equal(model.execution.summary.official, 30);
  assert.equal(model.automation.official, 37);
  assert.equal(model.totals.official, 144);
  const html = render(model);
  assert.match(html, /Current Build Runtime/);
  assert.match(html, /14/);
  assert.match(html, /8/);
  assert.match(html, /Current Build Runtime uses 30 selected TCs/);
  assert.match(html, /MX automation coverage contains 37 TCs/);
});

test('dashboard uses external Jenkins-safe stylesheet and no inline script/style block', () => {
  const html = render(buildDashboardModel({ ledger: ledger(), execution: build5Execution() }));
  assert.match(html, /<link rel="stylesheet" href="dashboard\.css">/);
  assert.doesNotMatch(html, /<style>/);
  assert.doesNotMatch(html, /<script>/);
});

test('Jenkins evidence URL points to archived artifact', () => {
  const execution = build5Execution();
  const href = evidenceHref(execution, 'test-results/jenkins/mx-qst/playwright/example/test-failed-1.png');
  assert.equal(href, 'http://localhost:8080/job/SAMSUNG-SMB-AUTOMATION/5/artifact/test-results/jenkins/mx-qst/playwright/example/test-failed-1.png');
  const html = render(buildDashboardModel({ ledger: ledger(), execution }));
  assert.match(html, /artifact\/test-results\/jenkins\/mx-qst\/playwright\/example\/test-failed-1\.png/);
});

test('executive remains useful with no execution evidence', () => {
  const model = buildDashboardModel({ ledger: null });
  assert.equal(model.totals.official, 144);
  assert.equal(model.totals.pending, 144);
  assert.match(render(model), /No real execution artifact was supplied/);
  assert.match(render(model), /MX Automation Coverage/);
});
