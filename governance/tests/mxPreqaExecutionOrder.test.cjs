const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { MX_BASE_P1_IDS } = require('../../utils/mxQstScope.cjs');

function discover(environment, id) {
  const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test',
    'tests/markets/mx/qst/base-store', '--list', '--reporter=json', ...(id ? ['--grep', `${id}\\b`] : [])], {
    env: { ...process.env, TEST_MARKET: 'MX', TEST_SUITE: 'P1/QST', MX_QST_ENVIRONMENT: environment },
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout), rows = [];
  function visit(suite) {
    for (const spec of suite.specs || []) for (const entry of spec.tests || []) rows.push({ id: spec.title.match(/SAM-\d+/)?.[0], project: entry.projectName });
    for (const child of suite.suites || []) visit(child);
  }
  report.suites.forEach(visit);
  return { rows, projects: report.config.projects };
}

test('S2 discovers all 29 official cases once, with the three WMC owners in the first independent project', () => {
  const { rows, projects } = discover('S2');
  assert.deepEqual(rows.map(row => row.id).sort(), [...MX_BASE_P1_IDS].sort());
  assert.deepEqual(projects.map(p => p.name), ['mx-preqa-priority', 'mx-auth-priority', 'chromium']);
  assert.deepEqual(rows.filter(row => row.project === 'mx-preqa-priority').map(row => row.id).sort(), ['SAM-24964', 'SAM-24968', 'SAM-24969']);
  assert.ok(projects.every(p => !(p.dependencies || []).length), 'WMC failure must never dependency-skip independent cases');
});

test('targeted checkout does not enter WMC project and targeted BC has only one owner', () => {
  assert.deepEqual(discover('S2', 'SAM-24995').rows, [{ id: 'SAM-24995', project: 'chromium' }]);
  assert.deepEqual(discover('S2', 'SAM-24969').rows, [{ id: 'SAM-24969', project: 'mx-preqa-priority' }]);
});

test('S1 preserves its original two-project order and 29-case ownership', () => {
  const { rows, projects } = discover('S1');
  assert.deepEqual(projects.map(p => p.name), ['mx-auth-priority', 'chromium']);
  assert.deepEqual(rows.map(row => row.id).sort(), [...MX_BASE_P1_IDS].sort());
});
