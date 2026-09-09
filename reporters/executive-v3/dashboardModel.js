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
  const releaseHealth = totals.fail > 0 ? 'ATTENTION' : totals.executed > 0 ? 'HEALTHY' : 'NO EXECUTION';
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
    },
    execution: execution || {},
  };
}

module.exports = { MARKETS, buildDashboardModel, countStatuses };
