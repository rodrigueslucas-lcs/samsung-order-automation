const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { credentialId } = require('../../scripts/auth-publish-jenkins-backoffice.cjs');
const source = fs.readFileSync('Jenkinsfile', 'utf8');
const official = source.slice(source.indexOf("stage('08 · Official P1')"));

test('Jenkins pipeline has no unresolved merge markers', () => {
  assert.doesNotMatch(source, /^<<<<<<< |^>>>>>>> /m);
});

for (const market of ['MX', 'PE', 'CO', 'CL']) {
  test(`${market} Jenkins consumes the shared credential selected for S1 or S2`, () => {
    assert.ok(official.includes(`env.${market}_BACKOFFICE_ADMIN_CREDENTIAL = params.ENVIRONMENT == 'S1' ? '${credentialId('S1')}' : '${credentialId('S2')}'`));
    assert.ok(official.includes(`file(credentialsId: env.${market}_BACKOFFICE_ADMIN_CREDENTIAL, variable: '${market}_BACKOFFICE_ADMIN_SECRET')`));
    const shellCopy = new RegExp(`cp "\\$${market}_BACKOFFICE_ADMIN_SECRET" "?playwright/\\.auth/backoffice-admin-\\$\\{BACKOFFICE_ENV\\}\\.json`);
    assert.match(official, shellCopy);
    assert.ok(official.includes(`copy /Y "%${market}_BACKOFFICE_ADMIN_SECRET%" "playwright\\\\.auth\\\\backoffice-admin-%BACKOFFICE_ENV%.json"`));
  });
}

test('all four MX auth branches provision BackOffice and CO S1 is no longer rejected', () => {
  const mx = official.slice(official.indexOf('env.MX_BACKOFFICE_ADMIN_CREDENTIAL ='));
  assert.equal((mx.match(/file\(credentialsId: env\.MX_BACKOFFICE_ADMIN_CREDENTIAL/g) || []).length, 4);
  assert.equal((mx.match(/cp "\$MX_BACKOFFICE_ADMIN_SECRET"/g) || []).length, 4);
  assert.equal((mx.match(/copy \/Y "%MX_BACKOFFICE_ADMIN_SECRET%"/g) || []).length, 4);
  assert.doesNotMatch(source, /params\.MARKET == 'CO' && params\.ENVIRONMENT != 'S2'/);
  assert.doesNotMatch(official, /backoffice-admin-s2\.json/);
});
