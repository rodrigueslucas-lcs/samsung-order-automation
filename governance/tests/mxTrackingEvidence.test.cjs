const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

test('reading a tracking OTP never captures the email as screenshot evidence', async () => {
  const source = fs.readFileSync(path.join(root, 'pages/MailinatorPage.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default class MailinatorPage', 'class MailinatorPage');
  const sandbox = { BasePage: class {}, process: { env: {} }, Date, Set };
  vm.runInNewContext(`${source}\nthis.MailinatorPage = MailinatorPage;`, sandbox);
  const reader = Object.create(sandbox.MailinatorPage.prototype);
  reader.page = { getByText: () => ({ waitFor: async () => {} }) };
  reader.snapshotInbox = async () => [];
  reader.inboxRows = async () => ({ count: async () => 1,
    nth: () => ({ evaluate: async () => 'new-message', click: async () => {} }) });
  reader.readOpenMessage = async () => ({ sender: 'Customer Services Team',
    subject: 'Samsung Código de Verificación', bodyText: 'fixture' });
  reader.extractOtp = () => 'synthetic-fixture';
  reader.screenshot = async () => { throw new Error('OTP email must not be captured'); };
  const result = await reader.waitForOtpEmail({ timeoutMs: 1000 });
  assert.equal(result.otp, 'synthetic-fixture');
});

test('tracking closes its email tab before submitting OTP and captures the known storefront error', () => {
  const source = fs.readFileSync(path.join(root, 'tests/markets/mx/qst/base-store/tracking-safe.spec.js'), 'utf8');
  const read = source.indexOf('otpEmail = await mailinator.waitForOtpEmail');
  const close = source.indexOf('await mailPage.close()', read);
  const submit = source.indexOf('await trackingPage.submitVerificationCode', read);
  assert.ok(read > 0 && close > read && submit > close);
  assert.match(source.slice(read, submit), /finally\s*\{[\s\S]*await mailPage\.close\(\);[\s\S]*await page\.bringToFront\(\)/);
  assert.match(source, /body: await notFoundMessage\.screenshot\(/);
  assert.match(source, /body: await page\.screenshot\(/);
});
