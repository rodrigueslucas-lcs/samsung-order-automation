const path = require('node:path');
const { validateSources } = require('./dstPilot.cjs');
const phase2 = require('../governance/dst-phase2-pilot.json');
const { loadOfficialInventory } = require('./officialSmbInventory');

function executionPlan(argv, env = process.env) {
  const market = String(argv[0] || '').toUpperCase();
  if (!['MX', 'PE', 'CO', 'CL'].includes(market)) throw new Error('DST_MARKET_REQUIRED: MX, PE, CO or CL.');
  const options = {};
  for (let index = 1; index < argv.length; index++) {
    const key = argv[index];
    if (key === '--list') { options.list = true; continue; }
    if (!['--store', '--priority', '--ids'].includes(key) || !argv[index + 1] || argv[index + 1].startsWith('--') || options[key]) throw new Error(`DST_INVALID_ARGUMENT: ${key}`);
    options[key] = argv[++index];
  }
  const store = String(options['--store'] || '').toUpperCase();
  const priority = String(options['--priority'] || '').toUpperCase();
  if (!['BASE_STORE', 'EPP'].includes(store) || !['P1', 'P2'].includes(priority)) throw new Error('DST_SCOPE_REQUIRED: explicit --store BASE_STORE|EPP and --priority P1|P2.');
  const environment = String(env.DST_ENVIRONMENT || 'S2').toUpperCase();
  if (!['S1', 'S2'].includes(environment)) throw new Error('DST_STAGING_REQUIRED: S1 or S2.');
  const ids = [...new Set(String(options['--ids'] || env.DST_TARGET_IDS || '').split(/[\s,;]+/).filter(Boolean))];
  if (!ids.length) throw new Error('DST_TARGET_REQUIRED: explicit official IDs; full campaigns remain disabled.');
  validateSources();
  const official = loadOfficialInventory().markets[market].contexts[store].rows;
  const cases = ids.map(id => {
    const row = official.find(row => (row.officialId || row.sourceRowKey) === id);
    if (!row || row.priority !== priority) throw new Error(`DST_OFFICIAL_SELECTION_MISMATCH: ${id}`);
    const entry = phase2.cases.find(entry => entry.id === id && entry.market === market && entry.store === store);
    if (!entry) throw new Error(`DST_NOT_IMPLEMENTED: ${id}; no legacy or QST fallback. Source row ${row.sourceRowKey}.`);
    if (entry.environmentRequired === 'S2_AND_PREQA2' && environment !== 'S2') throw new Error(`DST_ENVIRONMENT_REQUIRED: ${id} needs S2 and verified PreQA2.`);
    return entry;
  });
  const artifact = path.resolve('test-results/dst', market.toLowerCase(), store.toLowerCase(), priority.toLowerCase(), `${Date.now()}-${process.pid}`);
  const childEnv = { ...env };
  for (const candidate of ['MX', 'PE', 'CO', 'CL']) {
    delete childEnv[`${candidate}_QST_ENVIRONMENT`];
    childEnv[`${candidate}_AUTH_AUTO_RENEW`] = '0';
  }
  Object.assign(childEnv, {
    TEST_MARKET: market, TEST_SUITE: 'DST', TEST_STORE: store, DST_PRIORITY: priority,
    ENVIRONMENT: environment, [`${market}_QST_ENVIRONMENT`]: environment, BACKOFFICE_ENV: environment.toLowerCase(),
    ALLOW_PAYMENT_SUBMIT: '0', ALLOW_ORDER_SUBMIT: '0', ALLOW_PROFILE_WRITE: '0',
    ENABLE_ALLURE: '0', MX_QST_HEADLESS: env.BROWSER_MODE === 'headed' ? '0' : '1',
    PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(artifact, 'results.json'),
    PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(artifact, 'html'), SMB_EVIDENCE_DIR: path.join(artifact, 'evidence'),
  });
  return { market, store, priority, environment, cases, artifact, list: Boolean(options.list), childEnv,
    command: [require.resolve('@playwright/test/cli'), 'test', ...new Set(cases.map(c => c.spec)),
      '--project=chromium', '--workers=1', '--retries=0', '--grep', `(?:${ids.join('|')})\\b`,
      '--output', path.join(artifact, 'playwright'), ...(options.list ? ['--list', '--reporter=list'] : [])] };
}

module.exports = { executionPlan };
