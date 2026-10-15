const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { credentialId, publishBackoffice } = require('../../scripts/auth-publish-jenkins-backoffice.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bo-publisher-test-'));
  const file = path.join(directory, 'credential.json');
  fs.writeFileSync(file, JSON.stringify({ username: 'qa-admin', password: 'fake-test-password' }));
  t.after(() => { fs.unlinkSync(file); fs.rmdirSync(directory); });
  return file;
}

test('shared BackOffice IDs select the environment and reject unknown targets', () => {
  assert.equal(credentialId('S1'), 'samsung-mx-s1-backoffice-admin');
  assert.equal(credentialId('s2'), 'samsung-mx-s2-backoffice-admin');
  assert.throws(() => credentialId(), /explicitly/);
  assert.throws(() => credentialId('PROD'), /explicitly/);
});

for (const exists of [false, true]) {
  test(`BackOffice S1 publication ${exists ? 'updates' : 'creates'} only its shared credential`, async t => {
    let present = exists;
    const posts = [];
    const result = await publishBackoffice({
      environment: 'S1', credentialsFile: fixture(t), baseUrl: 'http://localhost:8080', user: 'qa', token: 'fake-api-token',
      fetchImpl: async (url, options) => {
        assert.equal(options.redirect, 'manual');
        assert.doesNotMatch(url, /samsung-mx-s2-backoffice-admin/);
        if (url.endsWith('/crumbIssuer/api/json')) return { ok: true, json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb' }) };
        if (options.method === 'POST') {
          posts.push({ url, body: options.body }); present = true;
          assert.equal(options.headers['Jenkins-Crumb'], 'test-crumb');
          return { ok: true };
        }
        return { status: present ? 200 : 404, ok: present };
      },
    });
    assert.equal(result.id, 'samsung-mx-s1-backoffice-admin');
    assert.equal(posts.length, 1);
    assert.ok(posts[0].url.endsWith(exists ? '/credential/samsung-mx-s1-backoffice-admin/config.xml' : '/createCredentials'));
    assert.match(posts[0].body, /<fileName>backoffice-admin-s1.json<\/fileName>/);
  });
}

test('BackOffice publication refuses insecure destinations and reports permission failures without secrets', async t => {
  const options = { environment: 'S1', credentialsFile: fixture(t), baseUrl: 'http://untrusted.example', user: 'qa', token: 'fake-api-token' };
  await assert.rejects(publishBackoffice(options), /HTTPS or a loopback/);
  await assert.rejects(publishBackoffice({
    ...options, baseUrl: 'http://localhost:8080',
    fetchImpl: async () => ({ status: 403, ok: false }),
  }), error => {
    assert.match(error.message, /HTTP 403/);
    assert.doesNotMatch(error.message, /fake-api-token|fake-test-password/);
    return true;
  });
});
