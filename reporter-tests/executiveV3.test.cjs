const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MX_BASE_P1_IDS,
  MX_BASE_P1_SOURCE_IDS,
  MX_BASE_P1_EXCLUSIONS,
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
      'SAM-25006': { status: 'NOT_APPLICABLE', context: 'registered', evidence: 'Historical result retained.', validatedAt: '2026-09-09T18:10:00.000Z' },
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

function buildExecution29() {
  const statuses = [
    ...Array(24).fill('PASS'), ...Array(4).fill('FAIL'), ...Array(1).fill('SKIPPED-BLOCKED'),
  ];
  return {
    buildNumber: '42', buildUrl: 'http://localhost:8080/job/SAMSUNG-SMB-AUTOMATION/42/', gitCommit: 'abc123', timestamp: '2026-09-24T01:00:00.000Z',
    market: 'MX', store: 'BASE_STORE', suite: 'P1/QST', environment: 'S2/STG2',
    summary: { official: 29, executed: 28, passed: 24, failed: 4, blocked: 1, notRun: 0, passRate: 85.714, duration: 1842000 },
    tests: statuses.map((status, index) => ({ samId: MX_BASE_P1_IDS[index], title: `Fixture ${index + 1}`, status, duration: 1000, attachments: index === 0 ? [{ name: 'screenshot', path: 'test-results/jenkins/mx-qst/playwright/example/test-failed-1.png' }] : [] })),
  };
}

test('historical 144-ID registry stays preserved while MX active runner has 29 TCs', () => {
  const model = buildDashboardModel({ ledger: ledger() });
  assert.equal(model.totals.official, 144);
  assert.equal(model.automation.official, 29);
  assert.equal(model.automation.sourceMapped, 30);
  assert.equal(model.automation.excluded.length, 1);
  assert.equal(model.automation.excluded[0].id, 'SAM-25006');
  assert.equal(MX_BASE_P1_SOURCE_IDS.length, 30);
  assert.equal(MX_BASE_P1_IDS.length, 29);
  assert.equal(Object.keys(MX_BASE_P1_EXCLUSIONS).length, 1);
  assert.ok(!MX_BASE_P1_IDS.includes('SAM-25006'));
});

test('feature coverage conserves the 29 active MX Base Store cases', () => {
  const rows = buildMxFeatureCoverage();
  const totals = rows.reduce((acc, row) => ({ total: acc.total + row.total, full: acc.full + row.full, partial: acc.partial + row.partial, missing: acc.missing + row.missing }), { total: 0, full: 0, partial: 0, missing: 0 });
  assert.equal(totals.total, 29);
  assert.equal(totals.full + totals.partial + totals.missing, 29);
});

test('automation gap queue only contains active partial/missing cases and excludes SAM-25006', () => {
  const gaps = buildAutomationGaps();
  assert.ok(gaps.length > 0);
  assert.ok(gaps.every(row => row.market === 'MX' && (row.coverage === 'partial' || row.coverage === 'missing')));
  assert.ok(!gaps.some(row => row.id === 'SAM-25006'));
});

test('historical catalog retains 144 rows and marks SAM-25006 historical-only', () => {
  const catalog = buildCaseCatalog(ledger());
  assert.equal(catalog.length, 144);
  const excluded = catalog.find(row => row.id === 'SAM-25006');
  assert.ok(excluded);
  assert.equal(excluded.scopeExcluded, true);
  assert.match(excluded.scopeExclusionReason, /PSE/i);
});

test('scope-excluded SAM-25006 is not treated as an environment handoff', () => {
  const handoffs = buildEnvironmentHandoffs(buildCaseCatalog(routedLedger()));
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0].id, 'SAM-24971');
  assert.equal(handoffs[0].toEnvironment, 'STAGING');
});

test('historical Market x Feature matrix conserves all catalog rows', () => {
  const catalog = buildCaseCatalog(ledger());
  const matrix = buildMarketFeatureMatrix(catalog);
  for (const market of ['MX', 'CL', 'CO', 'PE']) assert.equal(matrix.reduce((total, row) => total + row.markets[market].total, 0), catalog.filter(row => row.market === market).length);
});

test('trend keeps supplied historical snapshots intact', () => {
  const historical = ledger();
  historical.markets.MX.results = { 'SAM-24964': historical.markets.MX.results['SAM-24964'] };
  const rows = buildTrend([{ label: 'Earlier', ledger: historical }], ledger());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].executed, 1);
  assert.equal(rows[1].executed, 3);
});

test('consistency audit validates active scope exclusion and flags unknown IDs', () => {
  const audit = buildConsistencyAudit(ledger());
  assert.equal(audit.ok, true);
  assert.ok(audit.checks.some(check => check.key === 'mx-base-p1-scope-exclusions' && check.ok));
  const badLedger = ledger();
  badLedger.markets.MX.results['SAM-99999'] = { status: 'PASS' };
  assert.equal(buildConsistencyAudit(badLedger).ok, false);
});

test('current build runtime reconciles 29 = 24 PASS + 4 FAIL + 1 BLOCKED', () => {
  const execution = buildExecution29();
  const s = execution.summary;
  assert.equal(s.passed + s.failed + s.blocked + s.notRun, s.official);
  assert.equal(s.official, 29);
  assert.equal(s.passed, 24);
  assert.equal(s.failed, 4);
  assert.equal(s.blocked, 1);
});

test('render clearly separates active 29-TC runtime from historical/source scope', () => {
  const model = buildDashboardModel({ ledger: ledger(), execution: buildExecution29() });
  const html = render(model);
  assert.equal(model.execution.summary.official, 29);
  assert.equal(model.automation.official, 29);
  assert.equal(model.totals.official, 144);
  assert.match(html, /29-TC RUNNER/);
  assert.match(html, /Active P1\/QST 143/);
  assert.match(html, /SAM-25006/);
  assert.match(html, /EXCLUDED/);
});

test('Jenkins evidence URL points to archived artifact', () => {
  const execution = buildExecution29();
  const href = evidenceHref(execution, 'test-results/jenkins/mx-qst/playwright/example/test-failed-1.png');
  assert.equal(href, 'http://localhost:8080/job/SAMSUNG-SMB-AUTOMATION/42/artifact/test-results/jenkins/mx-qst/playwright/example/test-failed-1.png');
  const html = render(buildDashboardModel({ ledger: ledger(), execution }));
  assert.match(html, /artifact\/test-results\/jenkins\/mx-qst\/playwright\/example\/test-failed-1\.png/);
});

test('executive remains useful with no execution evidence', () => {
  const model = buildDashboardModel({ ledger: null });
  assert.equal(model.totals.official, 144);
  assert.equal(model.totals.pending, 144);
  assert.equal(model.automation.official, 29);
  assert.match(render(model), /No real execution artifact was supplied/);
  assert.match(render(model), /MX Base Store P1 Automation Coverage/);
});
