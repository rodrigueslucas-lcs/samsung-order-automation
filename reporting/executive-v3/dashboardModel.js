const smb = require('../../test-mapping/smb-qst.json');
const mxCoverage = require('../../test-mapping/mx-qst-coverage.json');
const peReusePlan = require('../../test-mapping/pe-qst-reuse-plan.json');
const { MX_BASE_P1_IDS, MX_BASE_P1_SOURCE_IDS, MX_BASE_P1_EXCLUSIONS, mxScopeExclusion } = require('../../utils/mxQstScope.cjs');

const MARKETS = ['MX', 'CL', 'CO', 'PE'];
const KNOWN_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE']);

// Base Store P1 implementation truth used by the dashboard. These overrides are
// intentionally conservative: FULL means the current automation proves the
// official business result; PARTIAL means automation exists but a documented
// official path/assertion is still incomplete. Runtime PASS/FAIL/BLOCKED is a
// separate dimension and always comes from the current execution artifact.
const MX_COVERAGE_OVERRIDES = Object.freeze({
  'SAM-24962': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/authenticated-safe.spec.js', test: 'SAM-24962 - Login Home page', notes: 'Registered session lands on the MX storefront home and proves My Profile is available.' },
  'SAM-24963': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/authenticated-safe.spec.js', test: 'SAM-24963 - Validate My account menu', notes: 'My Account menu options are explicitly validated in the authenticated flow.' },
  'SAM-24964': { coverage: 'full', notes: 'Dedicated GNB/category navigation automation is implemented for the official MX Base Store P1 case.' },
  'SAM-24968': { coverage: 'partial', notes: 'Facet/filter automation exists, but coverage remains partial until the official result-change behavior is consistently proven in the target runtime.' },
  'SAM-24969': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/bc-add-safe.spec.js', test: 'SAM-24969 - Add product from BC page', notes: 'PreQA2 BC catalog -> PDP -> Add to Cart flow is implemented and has runtime proof of the cart mutation. A later PDP-return timeout is an execution-stability issue, not missing implementation.' },
  'SAM-24971': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/safe-reuse.spec.js', test: 'SAM-24971 - Cart page UI', notes: 'Core cart UI/product/summary assertions are implemented; remaining official UI detail keeps this Partial.' },
  'SAM-24972': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/safe-reuse.spec.js', test: 'SAM-24972 - Increase decrease and delete cart quantity', notes: 'Quantity increase/decrease/delete and empty-cart confirmation are implemented.' },
  'SAM-24975': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/rewards-safe.spec.js', test: 'SAM-24975 - Rewards text on cart checkout and payment', notes: 'Rewards text is validated on Cart, Checkout and Payment. Tooltip interaction is still a documented remaining assertion.' },
  'SAM-24981': { coverage: 'partial', notes: 'Samsung Care+ automation exists and validates cart behavior, but the exact official BC/PDP-origin path is not yet fully proven.' },
  'SAM-24982': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/tradeup-safe.spec.js', test: 'SAM-24982 - Trade-up interaction preserves controlled cart', notes: 'Trade-up interaction is automated; complete official resulting-cart/delete behavior remains to be proven.' },
  'SAM-24985': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/extended-warranty-safe.spec.js', test: 'SAM-24985 - Add Extended Warranty on Cart', notes: 'Runtime-proven on S2 with the eligible PDP SKU and Service Pack association reflected in cart.' },
  'SAM-24986': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/cart-isolation-safe.spec.js', test: 'SAM-24986 - Cart is isolated from a second account', notes: 'Independent second-account cart isolation is automated. Explicit logout semantics from the official wording remain a coverage refinement.' },
  'SAM-24988': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/safe-reuse.spec.js', test: 'SAM-24988 - Checkout button on cart page', notes: 'Controlled cart Checkout navigation is explicitly proven.' },
  'SAM-24989': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/safe-reuse.spec.js', test: 'SAM-24989 - Order Summary on checkout page', notes: 'Order summary values are automated; deeper official presentation details remain partial.' },
  'SAM-24990': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/safe-reuse.spec.js', test: 'SAM-24990 - Contact information', notes: 'Mandatory guest contact information is filled and accepted before Delivery.' },
  'SAM-24991': { coverage: 'partial', notes: 'Registered new-address flow exists, but full edit/change behavior for saved/new addresses is not completely proven.' },
  'SAM-24992': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/registered-address-safe.spec.js', test: 'SAM-24992 - Select saved address', notes: 'Saved-address selection and checked state are explicitly validated when the authenticated test account has prerequisite data.' },
  'SAM-24993': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/registered-address-safe.spec.js', test: 'SAM-24993 - Save shipping and billing address option is available', notes: 'Runtime-proven registered-user save-address option behavior, including the S2 default-selected state.' },
  'SAM-24994': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/registered-address-safe.spec.js', test: 'SAM-24994 - Checkout accepts a new unsaved address', notes: 'Runtime-proven registered checkout with a new address while explicitly keeping the address unsaved.' },
  'SAM-24995': { coverage: 'full', notes: 'Guest checkout explicitly proves the Save option is not exposed.' },
  'SAM-24999': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/address-negative-safe.spec.js', test: 'SAM-24999 - Invalid address is rejected', notes: 'Invalid postal code produces an observable validation barrier and prevents normal delivery progression.' },
  'SAM-25000': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/registered-address-safe.spec.js', test: 'SAM-25000 - Switch saved and new address modes', notes: 'Saved/new address switching is automated. Delivery-mode switching remains a separate official path to prove.' },
  'SAM-25001': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/back-to-top-safe.spec.js', test: 'SAM-25001 - Back to Top returns the cart to the top', notes: 'Dedicated Back-to-Top control visibility and viewport return are explicitly validated.' },
  'SAM-25002': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/registered-order.spec.js', test: 'SAM-25002 - Complete card payment with registered user', notes: 'Runtime-proven registered Mercado Pago card payment through Samsung checkout to order confirmation.' },
  'SAM-25004': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/payment-modes-safe.spec.js', test: 'SAM-25004 - PayPal payment mode is available and selectable', notes: 'Real PayPal option availability/selection is automated safely; order submission is intentionally not claimed.' },
  'SAM-25005': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/payment-modes-safe.spec.js', test: 'SAM-25005 - Pay in Cash payment mode is available and selectable', notes: 'Real Pay in Cash option availability/selection is automated safely; order submission is intentionally not claimed.' },
  'SAM-25006': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/rewards-payment-registered-safe.spec.js', test: 'SAM-25006 - Rewards payment mode is available and selectable', notes: 'Historical implementation retained for traceability only. SAM-25006 is excluded from the active MX QST runner after the 2026-09-24 PSE/Colombia clarification.' },
  'SAM-25010': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/tracking-safe.spec.js', test: 'SAM-25010 - Track Order with email and Order ID', notes: 'Automation creates/reuses a causal guest order, requests OTP, reads the verification email and submits the code. S2 has also reproduced an order-not-found behavior after OTP; runtime result remains separate.' },
  'SAM-25011': { coverage: 'full', spec: 'tests/s1/mx/qst/base-store/backoffice.spec.js', test: 'SAM-25011 - BackOffice order and product basic advanced search', notes: 'Runtime-proven S2 BackOffice validation covers order/product search in both basic and advanced search modes when the environment credential is provisioned.' },
  'SAM-25016': { coverage: 'partial', spec: 'tests/s1/mx/qst/base-store/mobile-sticky.spec.js', test: 'SAM-25016 - Mobile Sticky checkout', notes: 'Sticky mobile cart checkout is proven; sticky behavior deeper in checkout remains a documented refinement.' },
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
    const exclusion = mxScopeExclusion(id);
    return {
      title: tc.title || exclusion?.title || null,
      feature: tc.feature || 'Unknown',
      store: tc.store || 'Unknown',
      coverage: exclusion ? null : tc.coverage || null,
      scopeExcluded: Boolean(exclusion),
      scopeExclusionReason: exclusion?.reason || null,
    };
  }
  if (market === 'PE') {
    const tc = peReusePlan.cases?.[id] || {};
    return { title: tc.title || null, feature: tc.feature || 'Unknown', store: tc.store || 'Unknown', coverage: tc.reuse || null, scopeExcluded: false, scopeExclusionReason: null };
  }
  return { title: null, feature: 'Unknown', store: 'Unknown', coverage: null, scopeExcluded: false, scopeExclusionReason: null };
}

function environmentMetadata(result = null) {
  if (!result) {
    return { validationEnvironment: null, nextEnvironment: null, environmentReason: null };
  }
  return {
    validationEnvironment: result.validationEnvironment || result.environment || result.sourceEnvironment || null,
    nextEnvironment: result.nextEnvironment || result.targetEnvironment || result.routeTo || result.handoffEnvironment || null,
    environmentReason: result.environmentReason || result.handoffReason || result.reason || null,
  };
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
        scopeExcluded: Boolean(meta.scopeExcluded),
        scopeExclusionReason: meta.scopeExclusionReason || null,
        status: result?.status || 'NOT_RUN',
        context: result?.context || 'unknown',
        runtimePath: result?.runtimePath || result?.path || null,
        evidence: result?.evidence || null,
        blocker: meta.scopeExcluded ? meta.scopeExclusionReason : result?.blocker || null,
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
    .filter(row => row.status === 'NOT_APPLICABLE' && !row.scopeExcluded)
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
  add('mx-base-p1-runner-count', Object.keys(runnerCases).length === MX_BASE_P1_IDS.length, `MX Base Store active P1 coverage rows ${Object.keys(runnerCases).length}; active runner ${MX_BASE_P1_IDS.length}`);
  add('mx-base-p1-coverage-summary', runnerSummaryTotal === MX_BASE_P1_IDS.length, `MX Full+Partial+Missing ${runnerSummaryTotal}; active runner ${MX_BASE_P1_IDS.length}`);
  add('mx-base-p1-scope-exclusions', MX_BASE_P1_SOURCE_IDS.length - MX_BASE_P1_IDS.length === Object.keys(MX_BASE_P1_EXCLUSIONS).length, `MX source-mapped P1 ${MX_BASE_P1_SOURCE_IDS.length}; active ${MX_BASE_P1_IDS.length}; exclusions ${Object.keys(MX_BASE_P1_EXCLUSIONS).length}`);
  add('mx-base-p1-excluded-not-active', Object.keys(MX_BASE_P1_EXCLUSIONS).every(id => !MX_BASE_P1_IDS.includes(id)), `Excluded IDs are absent from active runner: ${Object.keys(MX_BASE_P1_EXCLUSIONS).join(', ')}`);

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
      scopeExcluded: market === 'MX' ? Object.keys(MX_BASE_P1_EXCLUSIONS).length : 0,
      ...status,
      pending: Math.max(0, official - status.executed),
      validationPercent: official ? status.executed / official * 100 : 0,
      passPercent: official ? status.pass / official * 100 : 0,
      coverage,
    };
  });

  const totals = marketModels.reduce((acc, market) => {
    for (const key of ['official', 'executed', 'pass', 'fail', 'blocked', 'notApplicable', 'pending']) acc[key] += market[key];
    acc.scopeExcluded += market.scopeExcluded;
    return acc;
  }, { official: 0, executed: 0, pass: 0, fail: 0, blocked: 0, notApplicable: 0, pending: 0, scopeExcluded: 0 });

  const catalog = buildCaseCatalog(ledger);
  const validationRows = catalog.filter(row => row.status !== 'NOT_RUN' && !row.scopeExcluded);
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
      scope: 'MX_BASE_STORE_P1_ACTIVE',
      official: MX_BASE_P1_IDS.length,
      sourceMapped: MX_BASE_P1_SOURCE_IDS.length,
      excluded: Object.values(MX_BASE_P1_EXCLUSIONS),
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
  MX_BASE_P1_SOURCE_IDS,
  MX_BASE_P1_EXCLUSIONS,
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