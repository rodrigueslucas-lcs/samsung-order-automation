const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
const reportDir = path.resolve(process.argv[3] || path.join(path.dirname(resultsDir), 'allure-report'));

if (!fs.existsSync(resultsDir)) {
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

function writeEnvironment() {
  const file = path.join(resultsDir, 'environment.properties');
  const existing = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)
    : [];
  const managedKeys = new Set(['Market', 'Environment', 'Suite', 'Store', 'Build', 'GitCommit']);
  const kept = existing.filter((line) => !managedKeys.has(line.split('=')[0]));
  kept.push(
    `Market=${market}`,
    `Environment=${environment}`,
    `Suite=${suite}`,
    `Store=${store}`,
    `Build=${buildNumber}`,
    `GitCommit=${gitCommit}`,
  );
  fs.writeFileSync(file, `${kept.join('\n')}\n`);
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
  if (buildUrl) executor.buildUrl = buildUrl;
  if (buildUrl) executor.reportUrl = `${buildUrl}03_20_c2b7_20Samsung_20${market}_20${environment}_20${String(suite).replace(/\W+/g, '_')}_20_c2b7_20Allure_20HTML/`;
  fs.writeFileSync(path.join(resultsDir, 'executor.json'), JSON.stringify(executor, null, 2));
}

function writeCategories() {
  const categories = [
    {
      name: 'Known Functional Defect',
      matchedStatuses: ['skipped', 'failed', 'broken'],
      messageRegex: '.*Known Defect (RT|SAM)-[0-9]+.*',
    },
    {
      name: 'Automation Stability',
      matchedStatuses: ['failed', 'broken'],
      messageRegex: '.*(AUTOMATION_RECOVERY_EXHAUSTED|bounded wait/recovery|Timeout|timed out|timeout).*',
    },
    {
      name: 'Payment Outcome Unconfirmed',
      matchedStatuses: ['failed', 'broken'],
      messageRegex: '.*PAYMENT_OUTCOME_UNCONFIRMED.*',
    },
    {
      name: 'Authentication / Prerequisite',
      matchedStatuses: ['skipped', 'failed', 'broken'],
      messageRegex: '.*(AUTH BLOCKED|authentication|credentials|required prerequisite|test data).*',
    },
  ];
  fs.writeFileSync(path.join(resultsDir, 'categories.json'), JSON.stringify(categories, null, 2));
}

function carryHistory() {
  const previousHistory = path.join(reportDir, 'history');
  const targetHistory = path.join(resultsDir, 'history');
  if (!fs.existsSync(previousHistory)) return false;
  fs.rmSync(targetHistory, { recursive: true, force: true });
  fs.cpSync(previousHistory, targetHistory, { recursive: true });
  return true;
}

writeEnvironment();
writeExecutor();
writeCategories();
const historyCarried = carryHistory();
console.log(`[allure-metadata] READY · Jenkins executor + environment + categories${historyCarried ? ' + previous history' : ''}.`);
