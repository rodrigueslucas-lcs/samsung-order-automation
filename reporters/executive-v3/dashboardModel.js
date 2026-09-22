const smb = require('../../test-mapping/smb-qst.json');
const mxCoverage = require('../../test-mapping/mx-qst-coverage.json');
const peReusePlan = require('../../test-mapping/pe-qst-reuse-plan.json');

const MARKETS = ['MX', 'CL', 'CO', 'PE'];
const KNOWN_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE']);
const MX_BASE_P1_IDS = Object.freeze([
  'SAM-24962','SAM-24963','SAM-24964','SAM-24968','SAM-24969','SAM-24971','SAM-24972','SAM-24975','SAM-24981','SAM-24982',
  'SAM-24985','SAM-24986','SAM-24988','SAM-24989','SAM-24990','SAM-24991','SAM-24992','SAM-24993','SAM-24994','SAM-24995',
  'SAM-24999','SAM-25000','SAM-25001','SAM-25002','SAM-25004','SAM-25005','SAM-25006','SAM-25010','SAM-25011','SAM-25016',
]);

// Recent runtime-proven improvements that supersede stale entries in the preserved
// 37-ID mapping. This keeps the historical source intact while the presentation
// layer reports the current MX Base Store P1 implementation state truthfully.
const MX_COVERAGE_OVERRIDES = Object.freeze({
  'SAM-24969': {
    coverage: 'full',
    spec: 'tests/s1/mx/qst/base-store/bc-add-safe.spec.js',
    test: 'SAM-24969 - Add product from BC page',
    notes: 'Runtime-proven PreQA2 BC catalog -> PDP -> Add to Cart flow; the add request succeeds and minicart count increases.',
  },
  'SAM-24985': {
    coverage: 'full',
    spec: 'tests/s1/mx/qst/base-store/extended-warranty-safe.spec.js',
    test: 'SAM-24985 - Add Extended Warranty on Cart',
    notes: 'Runtime-proven on S2 with the eligible PDP SKU and Service Pack association reflected in cart.',
  },
  'SAM-24993': {
    coverage: 'full',
    notes: 'Runtime-proven registered-user save-address option behavior, including the S2 default-selected state.',
  },
  'SAM-24994': {
    coverage: 'full',
    notes: 'Runtime-proven registered checkout with a new address while explicitly keeping the address unsaved.',
  },
  'SAM-25002': {
    coverage: 'full',
    spec: 'tests/s1/mx/qst/base-store/registered-order.spec.js',
    test: 'SAM-25002 - Complete card payment with registered user',
    notes: 'Runtime-proven registered Mercado Pago card payment through Samsung checkout to order confirmation.',
  },
  'SAM-25010': {
    coverage: 'partial',
    notes: 'Automation creates the causal guest order, receives the verification email, extracts and submits OTP. S2 then returns order-not-found after successful OTP, reproduced manually and retained as an environment/functional defect rather than a fake PASS.',
  },
  'SAM-25011': {
    coverage: 'full',
    spec: 'tests/s1/mx/qst/base-store/backoffice.spec.js',
    test: 'SAM-25011 - BackOffice order search',
    notes: 'Runtime-proven S2 BackOffice validation covers order/product search in both basic and advanced search modes.',
  },
});

function effectiveMxCases() {
  return Object.fromEntries(Object.entries(mxCoverage.cases || {}).map(([id, tc]) => [
    id,
    { ...tc, ...(MX_COVERAGE_OVERRIDES[id] || {}) },
  ]));
}

function runnerMxCases() {
  const cases = effectiveMxCases();
  return Object.fromEntries(MX_BASE_P1_IDS.map(id => [id, cases[id]]).filter(([, tc]) => tc));
}

function coverageSummary(cases) {
  const values = Object.values(cases || {});
  return {
    full: values.filter(tc => tc?.coverage === 'full').length,
    partial: values.filter(tc => tc?.coverage === 'partial').length,
    missing: values.filter(tc => !tc?.coverage || tc.coverage === 'missing').length,
  };
}

function countStatuses(results = {}) {
  const values = Object.values(results);
  const count = status => values.filter(result => result?.status === status).length;
  return {
    executed: values.length,
    pass: count('PASS'),
    fail: count('FAIL'),
    blocked: count('BLOCKED'),
    notApplicable: count('NOT_APPLICABLE'),
  };
}

function coverageForMarket(market) {
  if (market !== 'MX') return { full: null, partial: null, missing: null, automated: null };
  const summary = coverageSummary(runnerMxCases());
  return { ...summary, automated: summary.full + summary.partial };
}

function metadataForCase(market, id) {
  if (market === 'MX') {
    const tc = effectiveMxCases()[id] || {};
    return { title: tc.title || null, feature: tc.feature || 'Unknown', store: tc.store || 'Unknown', coverage: tc.coverage || null };
  }
  if (market === 'PE') {
    const tc = peReusePlan.cases?.[id] || {};
    return { title: tc.title || null, feature: tc.feature || 'Unknown', store: tc.store || 'Unknown', coverage: tc.reuse || null };
  }
  return { title: null, feature: 'Unknown', store: 'Unknown', coverage: null };
}

function buildMxFeatureCoverage() {
  const features = new Map();
  for (const [id, tc] of Object.entries(runnerMxCases())) {
    const feature = tc.feature || 'Unclassified';
    if (!features.has(feature)) features.set(feature, { feature, total: 0, full: 0, partial: 0, missing: 0, baseStore: 0, epp: 0, ids: [] });
    const row = features.get(feature);
    row.total += 1;
    row.ids.push(id);
    if (tc.coverage === 'full') row.full += 1;
    else if (tc.coverage === 'partial') row.partial += 1;
    else row.missing += 1;
    if (tc.store === 'EPP') row.epp += 1;
    else row.baseStore += 1;
  }
  return [...features.values()].map(row => ({
    ...row,
    fullPercent: row.total ? row.full / row.total * 100 : 0,
    touchedPercent: row.total ? (row.full + row.partial) / row.total * 100 : 0,
  })).sort((a, b) => b.total - a.total || a.feature.localeCompare(b.feature));
}

function buildCaseCatalog(ledger = null) {
  const rows = [];
  for (const market of MARKETS) {
    const results = ledger?.markets?.[market]?.results || {};
    for (const id of smb.markets?.[market]?.cases || []) {
      const result = results[id] || null;
      const meta = metadataForCase(market, id);
      const environment = environmentMetadata(result);
      rows.push({
        id,
        market,
        title: result?.title || meta.title || 'Official metadata pending',
        feature: result?.feature || meta.feature || 'Unknown',
        store: result?.store || meta.store || 'Unknown',
        coverage: market === 'MX' ? meta.coverage : null,
        reuse: market === 'PE' ? meta.coverage : null,
        status: result?.status || 'NOT_RUN',
        context: result?.context || 'unknown',
        runtimePath: result?.runtimePath || result?.path || null,
        evidence: result?.evidence || null,
        blocker: result?.blocker || null,
        validatedAt: result?.validatedAt || null,
        automation: result?.automation || null,
        ...environment,
      });
    }
  }
  return rows;
}

function flattenLedger(ledger) {
  return buildCaseCatalog(ledger).filter(row => row.status !== 'NOT_RUN');
}

function buildAutomationGaps() {
  return Object.entries(runnerMxCases())
    .filter(([, tc]) => tc.coverage !== 'full')
    .map(([id, tc]) => ({ id, market: 'MX', title: tc.title, feature: tc.feature, store: tc.store, coverage: tc.coverage, notes: tc.notes || null }))
    .sort((a, b) => {
      const rank = { missing: 0, partial: 1 };
      return (rank[a.coverage] ?? 2) - (rank[b.coverage] ?? 2) || a.feature.localeCompare(b.feature) || a.id.localeCompare(b.id);
    });
}

function buildEnvironmentHandoffs(catalog) {
  return catalog
    .filter(row => row.status === 'NOT_APPLICABLE')
    .map(row => ({
      id: row.id,
      market: row.market,
      title: row.title,
      feature: row.feature,
      store: row.store,
      fromEnvironment: row.validationEnvironment || 'PreQA2',
      toEnvironment: row.nextEnvironment || 'UNSPECIFIED',
      reason: row.environmentReason || row.evidence || row.blocker || 'Not applicable in the supplied validation environment.',
      context: row.context,
    }));
}

function buildMarketFeatureMatrix(catalog) {
  const features = [...new Set(catalog.map(row => row.feature || 'Unknown'))].sort((a, b) => a.localeCompare(b));
  return features.map(feature => {
    const markets = {};
    for (const market of MARKETS) {
      const rows = catalog.filter(row => row.market === market && row.feature === feature);
      markets[market] = {
        total: rows.length,
        executed: rows.filter(row => row.status !== 'NOT_RUN').length,
        pass: rows.filter(row => row.status === 'PASS').length,
        fail: rows.filter(row => row.status === 'FAIL').length,
        blocked: rows.filter(row => row.status === 'BLOCKED').length,
        notApplicable: rows.filter(row => row.status === 'NOT_APPLICABLE').length,
        pending: rows.filter(row => row.status === 'NOT_RUN').length,
      };
    }
    return { feature, markets };
  });
}

function summarizeLedger(ledger) {
  const catalog = buildCaseCatalog(ledger);
  const count = status => catalog.filter(row => row.status === status).length;
  return {
    official: catalog.length,
    executed: catalog.filter(row => row.status !== 'NOT_RUN').length,
    pass: count('PASS'),
    fail: count('FAIL'),
    blocked: count('BLOCKED'),
    notApplicable: count('NOT_APPLICABLE'),
    pending: count('NOT_RUN'),
  };
}

function buildTrend(history = [], currentLedger = null) {
  const snapshots = [];
  for (const [index, item] of history.entries()) {
    const ledger = item?.ledger || item;
    if (!ledger?.markets) continue;
    const generatedAt = item?.generatedAt || item?.validatedAt || ledger?.generatedAt || null;
    snapshots.push({ index, generatedAt, label: item?.label || generatedAt || `Snapshot ${index + 1}`, ...summarizeLedger(ledger) });
  }
  if (currentLedger?.markets) {
    const current = summarizeLedger(currentLedger);
    const signature = JSON.stringify(current);
    const last = snapshots.at(-1);
    if (!last || JSON.stringify({ official:last.official,executed:last.executed,pass:last.pass,fail:last.fail,blocked:last.blocked,notApplicable:last.notApplicable,pending:last.pending }) !== signature) {
      snapshots.push({ index: snapshots.length, generatedAt: new Date().toISOString(), label: 'Current', ...current });
    }
  }
  return snapshots;
}

function buildConsistencyAudit(ledger = null) {
  const checks = [];
  const add = (key, ok, detail) => checks.push({ key, ok: Boolean(ok), detail });
  const marketSum = MARKETS.reduce((sum, market) => sum + (smb.markets?.[market]?.count || 0), 0);
  add('historical-registry-total', smb.total === marketSum, `Preserved registry total ${smb.total}; market sum ${marketSum}`);

  for (const market of MARKETS) {
    const ids = smb.markets?.[market]?.cases || [];
    add(`historical-registry-${market}`, ids.length === smb.markets?.[market]?.count && new Set(ids).size === ids.length, `${market}: ${ids.length}/${smb.markets?.[market]?.count} unique preserved IDs`);
  }

  const runnerCases = runnerMxCases();
  const runnerSummary = coverageSummary(runnerCases);
  const runnerSummaryTotal = runnerSummary.full + runnerSummary.partial + runnerSummary.missing;
  add('mx-base-p1-runner-count', Object.keys(runnerCases).length === MX_BASE_P1_IDS.length, `MX Base Store P1 coverage rows ${Object.keys(runnerCases).length}; official runner ${MX_BASE_P1_IDS.length}`);
  add('mx-base-p1-coverage-summary', runnerSummaryTotal === MX_BASE_P1_IDS.length, `MX Full+Partial+Missing ${runnerSummaryTotal}; runner ${MX_BASE_P1_IDS.length}`);

  for (const market of MARKETS) {
    const officialIds = new Set(smb.markets?.[market]?.cases || []);
    const results = ledger?.markets?.[market]?.results || {};
    const unknownIds = Object.keys(results).filter(id => !officialIds.has(id));
    const invalidStatuses = Object.entries(results).filter(([, result]) => !KNOWN_STATUSES.has(result?.status)).map(([id]) => id);
    add(`ledger-${market}-ids`, unknownIds.length === 0, unknownIds.length ? `${market}: unknown ledger IDs ${unknownIds.join(', ')}` : `${market}: all ledger IDs belong to the preserved registry`);
    add(`ledger-${market}-statuses`, invalidStatuses.length === 0, invalidStatuses.length ? `${market}: invalid statuses on ${invalidStatuses.join(', ')}` : `${market}: all executed statuses are canonical`);
  }

  return {
    ok: checks.every(check => check.ok),
    passed: checks.filter(check => check.ok).length,
    failed: checks.filter(check => !check.ok).length,
    checks,
  };
}

function buildDashboardModel({ ledger = null, execution = null, history = [] } = {}) {
  const marketModels = MARKETS.map(market => {
    const official = smb.markets[market]?.count || 0;
    const results = ledger?.markets?.[market]?.results || {};
    const status = countStatuses(results);
    const coverage = coverageForMarket(market);
    return {
      market,
      official,
      ...status,
      pending: Math.max(0, official - status.executed),
      validationPercent: official ? status.executed / official * 100 : 0,
      passPercent: official ? status.pass / official * 100 : 0,
      coverage,
    };
  });

  const totals = marketModels.reduce((acc, market) => {
    for (const key of ['official', 'executed', 'pass', 'fail', 'blocked', 'notApplicable', 'pending']) acc[key] += market[key];
    return acc;
  }, { official: 0, executed: 0, pass: 0, fail: 0, blocked: 0, notApplicable: 0, pending: 0 });

  const catalog = buildCaseCatalog(ledger);
  const validationRows = catalog.filter(row => row.status !== 'NOT_RUN');
  const attention = validationRows.filter(row => row.status === 'FAIL' || row.status === 'BLOCKED');
  const environmentHandoffs = buildEnvironmentHandoffs(catalog);
  const recent = validationRows
    .filter(row => row.validatedAt)
    .sort((a, b) => String(b.validatedAt).localeCompare(String(a.validatedAt)))
    .slice(0, 8);
  const audit = buildConsistencyAudit(ledger);
  const runtime = execution?.summary;
  const runnerCoverage = coverageForMarket('MX');
  const releaseHealth = !audit.ok ? 'DATA CHECK'
    : runtime ? (runtime.failed > 0 ? 'ATTENTION' : runtime.blocked > 0 ? 'WATCH' : runtime.executed > 0 ? 'HEALTHY' : 'NO EXECUTION')
    : totals.fail > 0 ? 'ATTENTION' : totals.blocked > 0 ? 'WATCH' : totals.executed > 0 ? 'HEALTHY' : 'NO EXECUTION';

  return {
    generatedAt: new Date().toISOString(),
    releaseHealth,
    totals,
    markets: marketModels,
    automation: {
      scope: 'MX_BASE_STORE_P1',
      official: MX_BASE_P1_IDS.length,
      ...runnerCoverage,
      fullPercent: runnerCoverage.full != null ? runnerCoverage.full / MX_BASE_P1_IDS.length * 100 : null,
      coveredPercent: runnerCoverage.automated != null ? runnerCoverage.automated / MX_BASE_P1_IDS.length * 100 : null,
      features: buildMxFeatureCoverage(),
      gaps: buildAutomationGaps(),
      ids: [...MX_BASE_P1_IDS],
    },
    validation: {
      attention,
      recent,
      rows: validationRows,
      catalog,
      marketFeatureMatrix: buildMarketFeatureMatrix(catalog),
      environmentHandoffs,
      stagingRequired: environmentHandoffs.filter(row => /stag|s1|s2|st2/i.test(row.toEnvironment)).length,
      handoffUnspecified: environmentHandoffs.filter(row => row.toEnvironment === 'UNSPECIFIED').length,
    },
    trend: buildTrend(history, ledger),
    audit,
    execution: execution || {},
  };
}

module.exports = {
  MARKETS,
  MX_BASE_P1_IDS,
  MX_COVERAGE_OVERRIDES,
  buildDashboardModel,
  countStatuses,
  buildMxFeatureCoverage,
  buildAutomationGaps,
  buildCaseCatalog,
  buildEnvironmentHandoffs,
  buildMarketFeatureMatrix,
  buildTrend,
  buildConsistencyAudit,
  environmentMetadata,
  flattenLedger,
};
