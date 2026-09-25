const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const config = fs.readFileSync('playwright.config.js', 'utf8');
const runner = fs.readFileSync('scripts/run-mx-qst-safe.cjs', 'utf8');
const jenkins = fs.readFileSync('Jenkinsfile', 'utf8');
const pkg = require('../../package.json');

test('Allure reporter is opt-in and isolated from list discovery', () => {
  assert.match(config, /process\.env\.ENABLE_ALLURE === '1'/);
  assert.match(config, /'allure-playwright'/);
  assert.match(config, /ALLURE_RESULTS_DIR/);
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
  assert.match(jenkins, /allure includeProperties: false/);
  assert.match(jenkins, /Native Allure history published/);
  assert.match(jenkins, /archiveArtifacts artifacts: 'test-results\/\*\*\/\*, playwright-report\/\*\*\/\*'/);
  assert.match(jenkins, /Executive Dashboard/);
  assert.match(jenkins, /Playwright/);
});
