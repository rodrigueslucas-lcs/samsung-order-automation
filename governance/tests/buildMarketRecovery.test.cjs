const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function selectorFixture(failures = 0) {
  let opens = 0, waits = 0, closes = 0, selections = 0;
  const source = fs.readFileSync('flows/cl/qstFlows.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const option = { filter() { return this; }, first() { return this; },
    async waitFor() { if (++waits <= failures) throw new Error('town options absent'); },
    async press(key) { assert.equal(key, 'Enter'); selections++; } };
  const control = { async click() { opens++; } };
  const page = { keyboard: { async press(key) { assert.equal(key, 'Escape'); closes++; } },
    locator: selector => { assert.equal(selector, '.cdk-overlay-pane:visible'); return {
      getByRole(role, options) { assert.equal(role, 'option'); assert.equal(options.name, 'Alhué'); assert.equal(options.exact, true); return option; },
    }; } };
  const select = vm.runInNewContext(`${source}\nselectClCheckoutOption;`, {
    clAuthStateModule: {}, evidenceContext: {}, expect: c => ({
      toBeEnabled: async () => assert.equal(c, control),
      toContainText: async name => { assert.equal(name, 'Alhué'); assert.equal(selections, 1); },
    }),
  });
  return {run: () => select(page, control, 'Alhué'), counts: () => ({opens, waits, closes, selections})};
}
test('hydrated CL commune is selected once and its selected value is proved', async () => {
  const f = selectorFixture(); await f.run(); assert.deepEqual(f.counts(), {opens:1, waits:1, closes:0, selections:1});
});
test('late dependent CL options reopen once without selecting a fallback commune', async () => {
  const f = selectorFixture(1); await f.run(); assert.deepEqual(f.counts(), {opens:2, waits:2, closes:1, selections:1});
});
test('a genuinely missing CL commune still fails after the bounded recovery', async () => {
  const f = selectorFixture(2); await assert.rejects(f.run(), /town options absent/);
  assert.deepEqual(f.counts(), {opens:2, waits:2, closes:1, selections:0});
});
test('Mailinator recovers an empty inbox once without discarding the historical OTP baseline', async () => {
  const source = fs.readFileSync('pages/MailinatorPage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default ', '');
  let time = 0, recoveries = 0, polls = 0, opens = 0;
  const Mail = vm.runInNewContext(`${source}\nMailinatorPage;`, {BasePage:class {}, process:{env:{}}, Date:{now:()=>time}, Set});
  const reader = Object.create(Mail.prototype);
  reader.page = {waitForTimeout:async ms=>{time+=ms;},getByText:()=>({waitFor:async()=>{}})};
  reader.snapshotInbox = async()=>{ polls++; return []; };
  reader.refreshInbox = async()=>{recoveries++;};
  reader.inboxRows = async()=>({count:async()=>recoveries ? 2 : 0, nth:index=>({
    evaluate:async()=>index===0?'historical-message':'fresh-message',click:async()=>{assert.equal(index,1);opens++;},
  })});
  reader.readOpenMessage = async()=>({sender:'Customer Services Team',subject:'Samsung Código de Verificación',bodyText:'fixture'});
  reader.extractOtp = ()=>'synthetic-fresh';
  const result = await reader.waitForOtpEmail({baselineMessageIds:['historical-message','__otp_count__:1'],baselineOtpCodes:['synthetic-old'],timeoutMs:60000,intervalMs:3000});
  assert.equal(recoveries,1); assert.equal(opens,1); assert.ok(polls>1); assert.equal(result.messageId,'fresh-message');
});
test('CI checkout CAPTCHA remains a concrete BLOCKED prerequisite with storefront evidence', () => {
  const source = fs.readFileSync('tests/markets/cl/qst/base-store/official-p1.spec.js','utf8');
  assert.match(source,/if \(!captchaVisible\) throw new Error/);
  assert.match(source,/testInfo\.attach\("CL checkout login requires human CAPTCHA"/);
  assert.match(source,/blocked\("Samsung Account displayed an interactive CAPTCHA/);
  assert.doesNotMatch(source,/if \(process\.env\.CI\) throw new Error\("Samsung Account requires/);
});
