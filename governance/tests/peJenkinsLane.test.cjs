const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('Jenkinsfile', 'utf8');
const stage = source.slice(source.indexOf("stage('08 · Official P1')"));
const pe = stage.slice(stage.indexOf("} else if (params.MARKET == 'PE') {"),
  stage.indexOf("env.MX_AUTH_STATE_CREDENTIAL"));

test('PE Jenkins supports both environments with environment-scoped buyer auth', () => {
  assert.doesNotMatch(source, /params\.MARKET == 'PE' && params\.ENVIRONMENT != 'S2'/);
  assert.match(source, /env\.PE_QST_ENVIRONMENT = params\.ENVIRONMENT/);
  assert.ok(pe.includes('samsung-pe-${params.ENVIRONMENT.toLowerCase()}-session-bundle'));
  assert.doesNotMatch(pe, /samsung-pe-s2-session-bundle/);
});

test('PE provisions the existing shared MX BackOffice credential for S1 and S2', () => {
  assert.ok(pe.includes("env.PE_BACKOFFICE_ADMIN_CREDENTIAL = params.ENVIRONMENT == 'S1' ? 'samsung-mx-s1-backoffice-admin' : 'samsung-mx-s2-backoffice-admin'"));
  assert.ok(pe.includes("file(credentialsId: env.PE_BACKOFFICE_ADMIN_CREDENTIAL, variable: 'PE_BACKOFFICE_ADMIN_SECRET')"));
  assert.match(source, /env\.BACKOFFICE_ENV = params\.ENVIRONMENT\.toLowerCase\(\)/);
  assert.ok(pe.includes('backoffice-admin-${BACKOFFICE_ENV}.json'));
  assert.ok(pe.includes('backoffice-admin-%BACKOFFICE_ENV%.json'));
  assert.doesNotMatch(pe, /backoffice-admin-s2\.json/);
});

test('both PE shell paths install buyer and BackOffice prerequisites before verification and execution', () => {
  const unix = pe.slice(pe.indexOf("authSh '''"), pe.indexOf('} else {'));
  const windows = pe.slice(pe.indexOf("authBat '''"));
  for (const script of [unix, windows]) {
    const install = script.indexOf('npm run auth:install:pe');
    const credential = script.indexOf('backoffice-admin-');
    const verify = script.indexOf('node scripts/verify-jenkins-storefront-auth.cjs pe');
    const run = script.indexOf('npx -y node@22 scripts/run-pe-qst-p1.cjs');
    assert.ok(install >= 0 && credential > install && verify > credential && run > verify);
  }
  assert.match(windows, /copy \/Y .*PE_BACKOFFICE_ADMIN_SECRET.*>nul \|\| exit \/b 2/);
  assert.match(unix, /set -eu/);
});
