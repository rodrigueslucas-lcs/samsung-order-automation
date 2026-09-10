const smb = require('../../test-mapping/smb-qst.json');
const mxCoverage = require('../../test-mapping/mx-qst-coverage.json');

const MARKETS = ['MX', 'CL', 'CO', 'PE'];

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

function flattenLedger(ledger) {
  const rows = [];
  for (const market of MARKETS) {
    for (const [id, result] of Object.entries(ledger?.markets?.[market]?.results || {})) {
      const mxMeta = market === 'MX' ? mxCoverage.cases?.[id] : null;
      rows.push({
        id,
        market,
        title: result?.title || mxMeta?.title || null,
        feature: result?.feature || mxMeta?.feature || null,
        store: result?.store || mxMeta?.store || null,
        status: result?.status || 'UNKNOWN',
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

function buildAutomationGaps() {
  return Object.entries(mxCoverage.cases || {})
    .filter(([, tc]) => tc.coverage !== 'full')
    .map(([id, tc]) => ({ id, market: 'MX', title: tc.title, feature: tc.feature, store: tc.store, coverage: tc.coverage, notes: tc.notes || null }))
    .sort((a, b) => {
      const rank = { missing: 0, partial: 1 };
      return (rank[a.coverage] ?? 2) - (rank[b.coverage] ?? 2) || a.feature.localeCompare(b.feature) || a.id.localeCompare(b.id);
    });
}

function buildDashboardModel({ ledger = null, execution = null } = {}) {
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
  const validationRows = flattenLedger(ledger);
  const attention = validationRows.filter(row => row.status === 'FAIL' || row.status === 'BLOCKED');
  const recent = validationRows
    .filter(row => row.validatedAt)
    .sort((a, b) => String(b.validatedAt).localeCompare(String(a.validatedAt)))
    .slice(0, 8);
  const releaseHealth = totals.fail > 0 ? 'ATTENTION' : totals.blocked > 0 ? 'WATCH' : totals.executed > 0 ? 'HEALTHY' : 'NO EXECUTION';

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
    },
    execution: execution || {},
  };
}

module.exports = {
  MARKETS,
  buildDashboardModel,
  countStatuses,
  buildMxFeatureCoverage,
  buildAutomationGaps,
  flattenLedger,
};
