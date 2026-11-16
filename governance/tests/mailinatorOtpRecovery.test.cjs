const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture({ ids = [], afterReload, code = '123456' } = {}) {
  let time = 0, reloads = 0, refreshes = 0, reads = 0;
  const locator = {};
  const page = { getByRole: () => locator, getByText: () => ({ waitFor: async () => {} }), waitForTimeout: async ms => { time += ms; } };
  const source = fs.readFileSync('pages/MailinatorPage.js', 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace('export default class MailinatorPage', 'class MailinatorPage');
  const Mail = vm.runInNewContext(`${source}\nMailinatorPage;`, { process: { env: {} }, Date: { now: () => time }, BasePage: class { constructor(page) { this.page = page; } } });
  const mail = new Mail(page, 'synthetic-qa');
  mail.snapshotInbox = async () => [];
  mail.inboxRows = async () => ({ count: async () => ids.length, nth: index => ({
    evaluate: async () => ids[index], click: async () => {},
  }) });
  mail.refreshInbox = async () => { refreshes++; };
  mail.openInbox = async () => { reloads++; if (afterReload) ids = afterReload; };
  mail.readOpenMessage = async () => { reads++; return { sender: 'Customer Services Team', subject: 'Samsung Código de Verificación', bodyText: `Customer Services Team: ${code}` }; };
  return { mail, stats: () => ({ time, reloads, refreshes, reads }) };
}
test('a silent empty inbox gets one fresh connection and retains the original baseline', async () => {
  const f = fixture({ afterReload: ['new-message'] });
  const result = await f.mail.waitForOtpEmail({ baselineMessageIds: ['historical', '__otp_count__:0'], timeoutMs: 180000, intervalMs: 15000 });
  assert.equal(result.messageId, 'new-message');
  assert.deepEqual(f.stats(), { time: 90000, reloads: 1, refreshes: 1, reads: 1 });
});
test('new stable message ID is eligible even when total row count is unchanged', async () => {
  const f = fixture({ ids: ['new-message'] });
  const result = await f.mail.waitForOtpEmail({ baselineMessageIds: ['old-message', '__otp_count__:1'], timeoutMs: 1000, intervalMs: 100 });
  assert.equal(result.messageId, 'new-message'); assert.equal(f.stats().reads, 1);
});
test('historical stable message ID never becomes eligible', async () => {
  const f = fixture({ ids: ['old-message'] });
  await assert.rejects(f.mail.waitForOtpEmail({ baselineMessageIds: ['old-message', '__otp_count__:1'], timeoutMs: 1000, intervalMs: 100 }), /OTP email was not found/);
  assert.equal(f.stats().reads, 0);
});
test('unchanged anonymous row count cannot reuse historical OTP without a code baseline', async () => {
  const f = fixture({ ids: [null] });
  await assert.rejects(f.mail.waitForOtpEmail({ baselineMessageIds: ['__otp_count__:1'], timeoutMs: 1000, intervalMs: 100 }), /OTP email was not found/);
  assert.equal(f.stats().reads, 0);
});
test('anonymous rows may be checked when historical OTP codes are known', async () => {
  const f = fixture({ ids: [null] });
  const result = await f.mail.waitForOtpEmail({ baselineMessageIds: ['__otp_count__:1'], baselineOtpCodes: ['654321'], timeoutMs: 1000, intervalMs: 100 });
  assert.equal(result.otp, '123456');
});
test('previous OTP codes remain ineligible after mailbox recovery', async () => {
  const f = fixture({ afterReload: ['new-message'] });
  await assert.rejects(f.mail.waitForOtpEmail({ baselineOtpCodes: ['123456'], timeoutMs: 120000, intervalMs: 15000 }), /OTP email was not found/);
  assert.equal(f.stats().reloads, 1);
});
test('persistent empty inbox fails within its deadline after only one hard reload', async () => {
  const f = fixture();
  await assert.rejects(f.mail.waitForOtpEmail({ timeoutMs: 180000, intervalMs: 15000 }), /within 180000ms/);
  assert.deepEqual(f.stats(), { time: 180000, reloads: 1, refreshes: 1, reads: 0 });
});
test('invalid poll deadlines fail before accessing the mailbox', async () => {
  for (const options of [{ timeoutMs: NaN }, { intervalMs: 0 }, { emptyInboxReloadAfterMs: -1 }]) {
    await assert.rejects(fixture().mail.waitForOtpEmail(options), /positive finite/);
  }
});
