const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const registry = require('../../governance/known-defects.json');
const { activeKnownDefects } = require('../../scripts/annotate-known-defects-dashboard.cjs');

const root = path.resolve(__dirname, '../..');

test('CL S2 SAM-24803 is tracked as SAM-25150 when runtime is blocked', () => {
  const defect = registry.defects.find(item =>
    item.market === 'CL'
    && item.environment === 'S2'
    && item.store === 'BASE_STORE'
    && item.samId === 'SAM-24803'
  );

  assert.ok(defect, 'CL S2 SAM-24803 must have an active registry entry.');
  assert.equal(defect.jira, 'SAM-25150');
  assert.equal(defect.classification, 'KNOWN_DEFECT');
  assert.equal(defect.status, 'OPEN');

  const runtime = {
    market: 'CL',
    environment: 'S2/STG2',
    store: 'BASE_STORE',
    suite: 'P1/QST',
    summary: { official: 31, executed: 0, passed: 0, failed: 0, blocked: 1, notRun: 30 },
    tests: [{
      samId: 'SAM-24803',
      title: 'Verify Recycle & Save Trade-in on cart page',
      status: 'SKIPPED-BLOCKED',
      failureType: 'TEST_DATA_BLOCKED',
      blockedReason: 'eligible CL Trade-in PDP SKU/test data is required.',
    }],
  };

  const active = activeKnownDefects(runtime, registry);
  assert.equal(active.length, 1);
  assert.equal(active[0].defect.jira, 'SAM-25150');
  assert.equal(active[0].test.samId, 'SAM-24803');
});

test('CL S2 SAM-24803 reporting keeps raw prerequisite truth while surfacing the mapped Jira defect', () => {
  const spec = fs.readFileSync(path.join(root, 'tests/markets/cl/qst/base-store/official-p1.spec.js'), 'utf8');
  const allure = fs.readFileSync(path.join(root, 'scripts/dedupe-allure-evidence.cjs'), 'utf8');

  assert.match(spec, /SAM-24803 @blocked @qst @cl @base-store/);
  assert.match(spec, /eligible CL Trade-in PDP SKU\/test data is required/);
  assert.match(allure, /mappedDefectTitle/);
  assert.match(allure, /Known Defect \$\{defectSummary\}/);
});
