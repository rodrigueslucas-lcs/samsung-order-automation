const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { selectPilot, validateSources } = require('../utils/dstPilot.cjs');
const { acquireMarketLease } = require('../utils/authMarketLease.cjs');

function plan(argv, env = process.env) {
  const market = String(argv[0] || '').toUpperCase();
  if (argv.some(arg => !['MX', 'PE', '--list'].includes(arg))) throw new Error('Use dst:pilot -- MX|PE [--list] with DST_TARGET_IDS.');
  const environment = String(env.DST_ENVIRONMENT || 'S2').toUpperCase();
  const cases = selectPilot({ market, ids: env.DST_TARGET_IDS, environment });
  validateSources();
  const list = argv.includes('--list');
  const artifact = path.resolve('test-results/dst-pilot', market.toLowerCase(), `${Date.now()}-${process.pid}`);
  const childEnv = { ...env, TEST_SUITE: 'DST', TEST_MARKET: market, TEST_STORE: 'BASE_STORE',
    [`${market}_QST_ENVIRONMENT`]: environment, ENVIRONMENT: environment,
    ALLOW_PAYMENT_SUBMIT: '0', ALLOW_ORDER_SUBMIT: '0', ALLOW_PROFILE_WRITE: '0',
    MX_AUTH_AUTO_RENEW: '0', PE_AUTH_AUTO_RENEW: '0', ENABLE_ALLURE: '0',
    MX_QST_HEADLESS: env.BROWSER_MODE === 'headed' ? '0' : '1',
    PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(artifact, 'results.json'),
    PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(artifact, 'html'), SMB_EVIDENCE_DIR: path.join(artifact, 'evidence') };
  const command = [require.resolve('@playwright/test/cli'), 'test', ...new Set(cases.map(c => c.spec)),
    '--project=chromium', '--workers=1', '--retries=0', '--grep', `(?:${cases.map(c => c.id).join('|')})\\b`,
    '--output', path.join(artifact, 'playwright'), ...(list ? ['--list', '--reporter=list'] : [])];
  return { market, environment, cases, list, artifact, childEnv, command };
}

function main(argv = process.argv.slice(2)) {
  const run = plan(argv);
  const release = run.list ? null : acquireMarketLease(run.market.toLowerCase(), run.environment);
  try {
    if (!run.list) fs.mkdirSync(run.artifact, { recursive: true });
    const env = { ...run.childEnv, ...release?.env };
    if (release) env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require="${path.resolve('utils/authLeasePreload.cjs').replace(/\\/g, '/')}"`.trim();
    console.log(`[dst-pilot] ${run.market} ${run.environment}: ${run.cases.map(c => c.id).join(', ')}; no payments; retries 0; ${run.list ? 'DISCOVERY' : run.artifact}`);
    return spawnSync(process.execPath, run.command, { env, stdio: 'inherit', windowsHide: true }).status ?? 1;
  } finally { release?.(); }
}

if (require.main === module) { try { process.exitCode = main(); } catch (error) { console.error(`[dst-pilot] ${error.code || 'BLOCKED'}: ${error.message}`); process.exitCode = 2; } }
module.exports = { plan, main };
