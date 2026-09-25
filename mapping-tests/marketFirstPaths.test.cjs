const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const EXECUTION_CONTRACT_FILES = [
  'package.json',
  'Jenkinsfile',
  'playwright.config.js',
  'config/testPaths.cjs',
  'scripts/run-mx-qst-safe.cjs',
  'scripts/run-mx-qst-fast-guest.cjs',
  'scripts/run-pe-qst-p1.cjs',
  'scripts/qst-run.cjs',
  'utils/qstImplementation.js',
];

test('execution contracts do not reintroduce environment-first test paths', () => {
  for (const relative of EXECUTION_CONTRACT_FILES) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(source, /tests[\\/]s[12][\\/]/i, `${relative} reintroduced tests/s1 or tests/s2`);
  }
});

test('canonical market-first test roots exist and old environment roots are absent', () => {
  const required = [
    'tests/markets/mx/qst/base-store',
    'tests/markets/mx/dst',
    'tests/markets/pe/qst/base-store',
    'tests/markets/pe/dst',
    'tests/shared/smb/qst',
    'tests/legacy/pe/qst',
  ];
  for (const relative of required) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, `missing canonical path ${relative}`);
  }
  assert.equal(fs.existsSync(path.join(root, 'tests/s1')), false, 'tests/s1 must stay removed');
  assert.equal(fs.existsSync(path.join(root, 'tests/s2')), false, 'tests/s2 must stay removed');
});
