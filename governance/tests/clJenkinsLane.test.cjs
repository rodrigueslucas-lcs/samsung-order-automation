const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('Jenkinsfile', 'utf8');
const stage = source.slice(source.indexOf("stage('08 · Official P1')"));
const cl = stage.slice(stage.indexOf("if (params.MARKET == 'CL') {"), stage.indexOf("} else if (params.MARKET == 'CO')"));

test('CL Jenkins Base Store supports S1/S2 and discovers exactly its BS scope', () => {
  assert.match(source, /choice\(name: 'ENVIRONMENT', choices: [^\r\n]+\? \['S2', 'S1'\] : \['S1', 'S2'\]/);
  assert.doesNotMatch(source, /params\.MARKET == 'CL' && params\.ENVIRONMENT != 'S2'/);
  assert.match(source, /env\.CL_QST_ENVIRONMENT = params\.ENVIRONMENT/);
  assert.match(source, /env\.CL_QST_STORE = 'BS'/);
  assert.match(source, /params\.MARKET == 'CL' \? '31'/);
  assert.match(source, /env\.CL_QST_TARGET_IDS = params\.P1_TARGET_IDS/);
  assert.match(source, /string\(name: 'CL_ORDER_CODE', defaultValue: ''/);
  assert.match(source, /env\.CL_QST_ORDER_CODE = params\.CL_ORDER_CODE\?\.trim\(\) \?: ''/);
});

test('CL Jenkins consumes the selected environment bundle and existing shared BackOffice credential', () => {
  assert.ok(cl.includes('samsung-cl-${params.ENVIRONMENT.toLowerCase()}-session-bundle'));
  assert.ok(cl.includes("env.CL_BACKOFFICE_ADMIN_CREDENTIAL = params.ENVIRONMENT == 'S1' ? 'samsung-mx-s1-backoffice-admin' : 'samsung-mx-s2-backoffice-admin'"));
  assert.ok(cl.includes('backoffice-admin-${BACKOFFICE_ENV}.json'));
  assert.ok(cl.includes('backoffice-admin-%BACKOFFICE_ENV%.json'));
  assert.doesNotMatch(cl, /samsung-cl-s2-session-bundle|backoffice-admin-s2\.json/);
});

test('CL Jenkins installs and verifies auth before runtime on both shell paths', () => {
  const unix = cl.slice(cl.indexOf("sh '''"), cl.indexOf('} else {'));
  const windows = cl.slice(cl.indexOf("bat '''"));
  for (const script of [unix, windows]) {
    const install = script.indexOf('npm run auth:install:cl');
    const verify = script.indexOf('node scripts/verify-jenkins-storefront-auth.cjs cl');
    const run = script.indexOf('npx -y node@22 scripts/run-cl-qst-p1.cjs');
    assert.ok(install >= 0 && verify > install && run > verify);
  }
  assert.match(source, /CL_AUTH_AUTO_RENEW = '0'/);
});

test('CL Jenkins derives mutation opt-ins from the explicit execution mode', () => {
  assert.ok(cl.includes("env.ALLOW_PAYMENT_SUBMIT = params.EXECUTION_MODE == 'authorized-destructive' ? '1' : '0'"));
  assert.ok(cl.includes("env.ALLOW_PROFILE_WRITE = params.EXECUTION_MODE == 'authorized-destructive' ? '1' : '0'"));
  assert.match(source, /params\.TEST_SUITE == 'official-p1' && params\.EXECUTION_MODE != 'authorized-destructive'/);
});

test('CL uses repository reporting without archiving auth bundles', () => {
  const archive = source.match(/archiveArtifacts artifacts: '([^']+)'/)[1];
  assert.equal(archive, 'test-results/**/*, playwright-report/**/*');
  assert.doesNotMatch(archive, /\.auth|session-packages|session-bundle/);
});
