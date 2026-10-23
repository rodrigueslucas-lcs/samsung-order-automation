const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
const reportDir = path.resolve(process.argv[3] || path.join(path.dirname(resultsDir), 'allure-report'));
const mode = String(process.argv[4] || 'prepare').toLowerCase();

if (!fs.existsSync(resultsDir) && mode !== 'save') {
  console.log('[allure-metadata] Results directory does not exist; nothing to prepare.');
  process.exit(0);
}

const market = String(process.env.TEST_MARKET || process.env.MARKET || 'SMB').toUpperCase();
const environment = String(
  process.env.MX_QST_ENVIRONMENT ||
  process.env.PE_QST_ENVIRONMENT ||
  process.env.CO_QST_ENVIRONMENT ||
  process.env.CL_QST_ENVIRONMENT ||
  process.env.ENVIRONMENT ||
  '—'
).toUpperCase();
const suite = String(process.env.TEST_SUITE || 'QST');
const store = String(process.env.TEST_STORE || 'BASE_STORE');
const buildNumber = String(process.env.BUILD_NUMBER || 'LOCAL');
const gitCommit = String(process.env.GIT_COMMIT || 'unknown');
const buildUrl = String(process.env.BUILD_URL || '');
const jenkinsUrl = String(process.env.JENKINS_URL || buildUrl || '');
const targetIds = String(
  process.env.MX_QST_TARGET_IDS ||
  process.env.PE_QST_TARGET_IDS ||
  process.env.CO_QST_TARGET_IDS ||
  process.env.CL_QST_TARGET_IDS ||
  ''
).trim();

function slug(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

const historyVariant = targetIds ? 'targeted' : 'full';
const historyCacheRoot = path.resolve(process.env.ALLURE_HISTORY_CACHE_DIR || '.allure-history-cache');
const historyCacheDir = path.join(historyCacheRoot, slug(market), slug(environment), slug(suite), slug(store), historyVariant);

function runOptional(scriptName, failureMessage) {
  const script = path.resolve(scriptName);
  if (!fs.existsSync(script)) return false;
  const result = spawnSync(process.execPath, [script, resultsDir], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(failureMessage);
    return false;
  }
  return true;
}

function writeEnvironment() {
  const file = path.join(resultsDir, 'environment.properties');
  // Keep the published Allure Overview executive-readable. Internal scope and
  // exclusion bookkeeping remains in runtime/governance artifacts, not here.
  const lines = [
    `Market=${market}`,
    `Environment=${environment}`,
    `Suite=${suite}`,
    `Store=${store}`,
    `Build=${buildNumber}`,
    `GitCommit=${gitCommit}`,
    `HistoryScope=${market}-${environment}-${historyVariant}`,
  ];
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function writeExecutor() {
  const buildName = `#${buildNumber} · ${market} · ${environment} · ${suite}`;
  const executor = {
    name: 'Jenkins',
    type: 'jenkins',
    buildOrder: Number.isFinite(Number(buildNumber)) ? Number(buildNumber) : 0,
    buildName,
    reportName: `Samsung SMB · ${market} ${environment} · ${suite}`,
  };
  if (jenkinsUrl) executor.url = jenkinsUrl;
  if (buildUrl) {
    executor.buildUrl = buildUrl;
    executor.reportUrl = buildUrl;
  }
  fs.writeFileSync(path.join(resultsDir, 'executor.json'), JSON.stringify(executor, null, 2));
}

function writeCategories() {
  const categories = [
    { name: 'Known Defect', matchedStatuses: ['unknown', 'skipped', 'failed', 'broken'], messageRegex: '.*KNOWN DEFECT.*(RT|SAM)-[0-9]+.*' },
    { name: 'Auth / Prerequisite', matchedStatuses: ['skipped', 'failed', 'broken'], messageRegex: '.*(BLOCKED|AUTH BLOCKED|authentication|credentials|required prerequisite|test data|prerequisite).*' },
    { name: 'Automation Stability', matchedStatuses: ['failed', 'broken'], messageRegex: '.*(AUTOMATION_RECOVERY_EXHAUSTED|bounded wait/recovery|Timeout|timed out|timeout).*' },
    { name: 'Payment Outcome', matchedStatuses: ['failed', 'broken'], messageRegex: '.*PAYMENT_OUTCOME_UNCONFIRMED.*' },
  ];
  fs.writeFileSync(path.join(resultsDir, 'categories.json'), JSON.stringify(categories, null, 2));
}

function restoreHistory() {
  const targetHistory = path.join(resultsDir, 'history');
  const cachedHistory = path.join(historyCacheDir, 'history');
  const previousReportHistory = path.join(reportDir, 'history');
  const source = fs.existsSync(cachedHistory) ? cachedHistory : fs.existsSync(previousReportHistory) ? previousReportHistory : null;
  if (!source) {
    console.log(`[allure-history] No baseline yet for ${market} ${environment} ${suite} ${historyVariant}; this build will seed the Trend cache.`);
    return false;
  }
  fs.rmSync(targetHistory, { recursive: true, force: true });
  fs.cpSync(source, targetHistory, { recursive: true });
  console.log(`[allure-history] Restored Trend baseline for ${market} ${environment} ${suite} ${historyVariant} from ${source}.`);
  return true;
}

function saveHistory() {
  const generatedHistory = path.join(reportDir, 'history');
  if (!fs.existsSync(generatedHistory)) {
    console.log(`[allure-history] Generated report has no history to persist for ${market} ${environment}.`);
    return false;
  }
  const target = path.join(historyCacheDir, 'history');
  fs.mkdirSync(historyCacheDir, { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(generatedHistory, target, { recursive: true });
  console.log(`[allure-history] Persisted Trend history for ${market} ${environment} ${suite} ${historyVariant} at ${target}.`);
  return true;
}

if (mode === 'save') {
  saveHistory();
  process.exit(0);
}

const businessStatusNormalized = runOptional('scripts/normalize-allure-business-status.cjs', '[allure-metadata] Business-status normalization failed; existing Allure statuses were preserved.');
const polished = runOptional('scripts/polish-allure-presentation.cjs', '[allure-metadata] Presentation polish failed; normalized results were preserved.');
const businessViewStructured = runOptional('scripts/structure-allure-business-view.cjs', '[allure-metadata] Structured business view failed; polished results were preserved.');
const globalContractEnforced = runOptional('scripts/enforce-allure-global-contract.cjs', '[allure-metadata] Global Allure contract failed; structured results were preserved.');
writeEnvironment();
writeExecutor();
writeCategories();
const historyCarried = restoreHistory();
console.log(`[allure-metadata] READY · business status ${businessStatusNormalized ? 'normalized' : 'unchanged'} · presentation ${polished ? 'polished' : 'unchanged'} · business view ${businessViewStructured ? 'structured' : 'unchanged'} · global contract ${globalContractEnforced ? 'enforced' : 'unchanged'} · Jenkins executor + concise environment + categories${historyCarried ? ' + Trend history' : ''}.`);
