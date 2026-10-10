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

test('generic Jenkins finalizer normalizes Allure evidence before generating the HTML report', () => {
  assert.match(finalizer, /dedupe-allure-evidence\.cjs/);
  const normalizeAt = finalizer.indexOf('normalizeAllureEvidence();');
  const annotateAt = finalizer.indexOf('annotateKnownDefects();');
  const generateAt = finalizer.indexOf('generateAllure();');
  assert.ok(normalizeAt >= 0, 'generic finalizer must normalize Allure evidence');
  assert.ok(generateAt >= 0, 'generic finalizer must generate the Allure HTML report');
  assert.ok(normalizeAt < generateAt, 'Allure evidence must be normalized before HTML generation');
  if (annotateAt >= 0) {
    assert.ok(normalizeAt < annotateAt, 'evidence normalization should happen before dashboard annotation');
    assert.ok(annotateAt < generateAt, 'dashboard annotation should complete before Allure HTML generation');
  }
});

test('Allure evidence dedupe removes byte-identical copies but preserves distinct multi-page media', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smb-allure-evidence-'));
  try {
    const write = (name, size, byte) => {
      fs.writeFileSync(path.join(dir, name), Buffer.alloc(size, byte));
      return name;
    };
    const resultFile = path.join(dir, 'sample-result.json');
    const storefrontVideo = write('storefront.webm', 500, 5);
    const mailinatorVideo = write('mailinator.webm', 300, 6);
    const duplicateStorefrontVideo = write('storefront-copy.webm', 500, 5);
    const result = {
      name: 'SAM-25010',
      attachments: [
        { name: 'video', type: 'video/webm', source: storefrontVideo },
        { name: 'video', type: 'video/webm', source: mailinatorVideo },
        { name: 'screenshot', type: 'image/png', source: write('final.png', 100, 1) },
      ],
      steps: [
        {
          name: 'nested reporter copy',
          attachments: [
            { name: 'video', type: 'video/webm', source: duplicateStorefrontVideo },
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

    const videos = all.filter((item) => /video\//i.test(item.type || ''));
    assert.equal(videos.length, 2);
    assert.deepEqual(new Set(videos.map((item) => item.source)), new Set([storefrontVideo, mailinatorVideo]));
    assert.equal(all.filter((item) => /image\//i.test(item.type || '')).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
