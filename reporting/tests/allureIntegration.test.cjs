const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const config = fs.readFileSync('playwright.config.js', 'utf8');
const runner = fs.readFileSync('scripts/run-mx-qst-safe.cjs', 'utf8');
const jenkins = fs.readFileSync('Jenkinsfile', 'utf8');
const finalizer = fs.readFileSync('scripts/finalize-jenkins-suite.cjs', 'utf8');
const pkg = require('../../package.json');

test('Allure reporter is opt-in and isolated from list discovery', () => {
  assert.match(config, /process\.env\.ENABLE_ALLURE === '1'/);
  assert.match(config, /'allure-playwright'/);
  assert.match(config, /ALLURE_RESULTS_DIR/);
  // Detailed execution steps are enabled intentionally; reporter activation
  // and list isolation remain controlled separately by ENABLE_ALLURE/--reporter.
  assert.match(config, /detail: true/);
  assert.match(runner, /ENABLE_ALLURE: process\.env\.ENABLE_ALLURE \|\| "0"/);
  assert.match(runner, /allure-results/);
  assert.match(runner, /"--list", "--reporter=list"/);
});

test('Allure tooling is pinned without changing package-lock', () => {
  assert.equal(
    pkg.scripts['reporting:allure:install'],
    'npm install --no-save --package-lock=false --ignore-scripts allure-playwright@3.11.1 allure-commandline@2.43.0'
  );
});

test('Jenkins enables, archives and publishes Allure beside Executive and Playwright reports', () => {
  assert.match(jenkins, /ENABLE_ALLURE = '1'/);
  assert.match(jenkins, /npm run reporting:allure:install/);
  assert.doesNotMatch(jenkins, /allure includeProperties: false/);
  assert.match(jenkins, /repository-pinned tooling/);
  assert.match(jenkins, /archiveArtifacts artifacts: 'test-results\/\*\*\/\*, playwright-report\/\*\*\/\*'/);
  assert.match(jenkins, /Executive Dashboard/);
  assert.match(jenkins, /Playwright/);
});

test('generic Jenkins finalizer normalizes Allure evidence for every non-MX-specialized market path', () => {
  assert.match(finalizer, /dedupe-allure-evidence\.cjs/);
  assert.match(finalizer, /normalizeAllureEvidence\(\);\s*\ngenerateAllure\(\);/);
});

test('Allure evidence policy publishes at most one primary screenshot, video, trace and context per test', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smb-allure-evidence-'));
  try {
    const write = (name, size, byte) => {
      fs.writeFileSync(path.join(dir, name), Buffer.alloc(size, byte));
      return name;
    };
    const resultFile = path.join(dir, 'sample-result.json');
    const result = {
      name: 'SAM-TEST',
      attachments: [
        { name: 'screenshot', type: 'image/png', source: write('generic.png', 100, 1) },
        { name: 'video', type: 'video/webm', source: write('helper.webm', 100, 2) },
        { name: 'trace', type: 'application/zip', source: write('trace-a.zip', 80, 3) },
      ],
      steps: [
        {
          name: 'business step',
          attachments: [
            { name: 'mx-known-defect-context', type: 'image/png', source: write('defect.png', 250, 4) },
            { name: 'video', type: 'video/webm', source: write('main.webm', 500, 5) },
            { name: 'trace', type: 'application/zip', source: write('trace-b.zip', 120, 6) },
            { name: 'error-context', type: 'text/markdown', source: write('error.md', 60, 7) },
            { name: 'error-context-copy', type: 'text/markdown', source: write('error-copy.md', 70, 8) },
          ],
          steps: [],
        },
      ],
    };
    fs.writeFileSync(resultFile, JSON.stringify(result));

    const run = spawnSync(process.execPath, ['scripts/dedupe-allure-evidence.cjs', dir], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    const normalized = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    const all = [];
    const collect = (attachments) => all.push(...(attachments || []));
    const visit = (steps) => {
      for (const step of steps || []) {
        collect(step.attachments);
        visit(step.steps);
      }
    };
    collect(normalized.attachments);
    visit(normalized.steps);

    const count = (pattern) => all.filter((item) => pattern.test(`${item.name} ${item.type} ${item.source}`)).length;
    assert.equal(count(/Screenshot · Final state|image\//i), 1);
    assert.equal(count(/Video · Execution|video\//i), 1);
    assert.equal(count(/Playwright Trace|application\/zip/i), 1);
    assert.equal(count(/Error Context|\.md$/i), 1);

    assert.equal(all.find((item) => item.name === 'Screenshot · Final state')?.source, 'defect.png');
    assert.equal(all.find((item) => item.name === 'Video · Execution')?.source, 'main.webm');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
