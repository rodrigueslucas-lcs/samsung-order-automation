const smb = require('../../test-mapping/smb-qst.json');
const mxCoverage = require('../../test-mapping/mx-qst-coverage.json');
const peReusePlan = require('../../test-mapping/pe-qst-reuse-plan.json');

const MARKETS = ['MX', 'CL', 'CO', 'PE'];
const KNOWN_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE']);

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
  const summary = mxCoverage.summary || {};
  const full = summary.full ?? 0;
  const partial = summary.partial ?? 0;
  const missing = summary.missing ?? 0;
  return { full, partial, missing, automated: full + partial };
}

function metadataForCase(market, id) {
  if (market === 'MX') {
    const tc = mxCoverage.cases?.[id] || {};
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
  for (const [id, tc] of Object.entries(mxCoverage.cases || {})) {
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
      });
    }
  }
  return rows;
}

function flattenLedger(ledger) {
  return buildCaseCatalog(ledger).filter(row => row.status !== 'NOT_RUN');
}

function buildAutomationGaps() {
  return Object.entries(mxCoverage.cases || {})
    .filter(([, tc]) => tc.coverage !== 'full')
    .map(([id, tc]) => ({ id, market: 'MX', title: tc.title, feature: tc.feature, store: tc.store, coverage: tc.coverage, notes: tc.notes || null }))
    .sort((a, b) => {
      const rank = { missing: 0, partial: 1 };
      return (rank[a.coverage] ?? 2) - (rank[b.coverage] ?? 2) || a.feature.localeCompare(b.feature) || a.id.localeCompare(b.id);
    });
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
  add('official-total', smb.total === marketSum, `Registry total ${smb.total}; market sum ${marketSum}`);

  for (const market of MARKETS) {
    const ids = smb.markets?.[market]?.cases || [];
    add(`registry-${market}`, ids.length === smb.markets?.[market]?.count && new Set(ids).size === ids.length, `${market}: ${ids.length}/${smb.markets?.[market]?.count} unique official IDs`);
  }

  const mxCases = Object.keys(mxCoverage.cases || {});
  const mxSummaryTotal = (mxCoverage.summary?.full || 0) + (mxCoverage.summary?.partial || 0) + (mxCoverage.summary?.missing || 0);
  add('mx-coverage-case-count', mxCases.length === smb.markets.MX.count, `MX coverage cases ${mxCases.length}; official ${smb.markets.MX.count}`);
  add('mx-coverage-summary', mxSummaryTotal === smb.markets.MX.count, `MX Full+Partial+Missing ${mxSummaryTotal}; official ${smb.markets.MX.count}`);

  for (const market of MARKETS) {
    const officialIds = new Set(smb.markets?.[market]?.cases || []);
    const results = ledger?.markets?.[market]?.results || {};
    const unknownIds = Object.keys(results).filter(id => !officialIds.has(id));
    const invalidStatuses = Object.entries(results).filter(([, result]) => !KNOWN_STATUSES.has(result?.status)).map(([id]) => id);
    add(`ledger-${market}-ids`, unknownIds.length === 0, unknownIds.length ? `${market}: unknown ledger IDs ${unknownIds.join(', ')}` : `${market}: all ledger IDs are official`);
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

  const mx = marketModels.find(item => item.market === 'MX');
  const catalog = buildCaseCatalog(ledger);
  const validationRows = catalog.filter(row => row.status !== 'NOT_RUN');
  const attention = validationRows.filter(row => row.status === 'FAIL' || row.status === 'BLOCKED');
  const recent = validationRows
    .filter(row => row.validatedAt)
    .sort((a, b) => String(b.validatedAt).localeCompare(String(a.validatedAt)))
    .slice(0, 8);
  const audit = buildConsistencyAudit(ledger);
  const releaseHealth = !audit.ok ? 'DATA CHECK' : totals.fail > 0 ? 'ATTENTION' : totals.blocked > 0 ? 'WATCH' : totals.executed > 0 ? 'HEALTHY' : 'NO EXECUTION';

  return {
    generatedAt: new Date().toISOString(),
    releaseHealth,
    totals,
    markets: marketModels,
    automation: {
      scope: 'MX',
      official: mx.official,
      ...mx.coverage,
      fullPercent: mx.official && mx.coverage.full != null ? mx.coverage.full / mx.official * 100 : null,
      coveredPercent: mx.official && mx.coverage.automated != null ? mx.coverage.automated / mx.official * 100 : null,
      features: buildMxFeatureCoverage(),
      gaps: buildAutomationGaps(),
    },
    validation: {
      attention,
      recent,
      rows: validationRows,
      catalog,
      marketFeatureMatrix: buildMarketFeatureMatrix(catalog),
    },
    trend: buildTrend(history, ledger),
    audit,
    execution: execution || {},
  };
}

module.exports = {
  MARKETS,
  buildDashboardModel,
  countStatuses,
  buildMxFeatureCoverage,
  buildAutomationGaps,
  buildCaseCatalog,
  buildMarketFeatureMatrix,
  buildTrend,
  buildConsistencyAudit,
  flattenLedger,
};
