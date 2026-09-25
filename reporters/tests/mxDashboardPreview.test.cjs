const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./fixtures/executive-v3/build-5-runtime-summary.json');

test('Build #5 preview fixture reconciles current runtime independently from MX coverage', () => {
  const s = fixture.summary;
  assert.equal(s.official, 30);
  assert.equal(s.executed, 22);
  assert.equal(s.passed, 14);
  assert.equal(s.failed, 8);
  assert.equal(s.blocked, 8);
  assert.equal(s.notRun, 0);
  assert.equal(s.passed + s.failed + s.blocked + s.notRun, 30);
  assert.equal(fixture.tests.length, 30);
});

test('preview command is wired to reporting generator and Build #5 fixture', () => {
  const pkg = require('../../package.json');
  assert.equal(pkg.scripts['reporting:mx:preview'], 'node scripts/preview-mx-dashboard.cjs');
  const preview = fs.readFileSync(path.resolve(__dirname, '../../scripts/preview-mx-dashboard.cjs'), 'utf8');
  assert.equal(preview.indexOf('generateExecutiveV3.cjs') >= 0, true);
  assert.equal(preview.indexOf('build-5-runtime-summary.json') >= 0, true);
});
