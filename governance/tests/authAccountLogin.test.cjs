const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completeAccountLogin } = require('../../utils/authAccountLogin.cjs');

function scenario({ initial = 'email', captcha = false, remainCaptcha = false, market = 'pe', hostname = 'stg2.shop.samsung.com', warm = false } = {}) {
  let state = initial, clock = 0, url = warm ? `https://${hostname}/${market}/` : 'https://account.samsung.com/accounts/fixture';
  const calls = [], logs = [];
  const locator = visible => ({ filter() { return this; }, first() { return this; }, last() { return this; },
    isVisible: async () => visible(), count: async () => Number(visible()), fill: async () => calls.push('fill-' + state),
    click: async () => { calls.push('click-' + state); if (state === 'email') state = captcha ? 'captcha' : 'password'; else url = `https://${hostname}/${market}/`; } });
  const page = { isClosed: () => false, url: () => url,
    locator: selector => selector.includes('iframe') ? locator(() => state === 'captcha') : locator(() => state === (selector.includes('password') ? 'password' : 'email')),
    getByText: () => locator(() => false), getByRole: () => locator(() => true),
  };
  const run = () => completeAccountLogin(page, { market, hostname, credentials: { email: 'fixture@example.test', password: 'fixture-only' },
    timeout: 1000, now: () => clock, pause: async ms => { clock += ms; if (state === 'captcha' && !remainCaptcha && clock >= 500) state = 'password'; }, log: line => logs.push(line) });
  return { run, calls, logs };
}

for (const market of ['mx', 'pe', 'co', 'cl']) for (const hostname of ['stg.shop.samsung.com', 'stg2.shop.samsung.com']) {
  test(`${market} ${hostname} submits email and password once then hands off to auth verification`, async () => {
    const s = scenario({ market, hostname }); await s.run();
    assert.deepEqual(s.calls, ['fill-email', 'click-email', 'fill-password', 'click-password']);
    assert.ok(s.logs.every(line => !/fixture-only|fixture@example/.test(line)));
  });
}

test('resuming at password does not send the email step again', async () => {
  const s = scenario({ initial: 'password' }); await s.run();
  assert.deepEqual(s.calls, ['fill-password', 'click-password']);
});
test('CAPTCHA waits for human completion without another email or Next click', async () => {
  const s = scenario({ captcha: true }); await s.run();
  assert.deepEqual(s.calls, ['fill-email', 'click-email', 'fill-password', 'click-password']);
  assert.ok(s.logs.some(line => /human completion/.test(line)));
});
test('unresolved human verification is typed and never resubmits credentials', async () => {
  const s = scenario({ initial: 'captcha', remainCaptcha: true });
  await assert.rejects(s.run(), error => error.exitCode === 79);
  assert.deepEqual(s.calls, []);
});

test('visible reCAPTCHA checkbox modal is human verification even before its challenge frame opens', async () => {
  let fills = 0, clock = 0;
  const locator = visible => ({ filter() { return this; }, first() { return this; }, last() { return this; },
    count: async () => Number(visible), isVisible: async () => visible, fill: async () => { fills++; } });
  const page = { isClosed: () => false, url: () => 'https://account.samsung.com/accounts/fixture',
    locator: selector => locator(selector.includes('iframe') ? selector.includes('[title="reCAPTCHA" i]') : true),
    getByText: () => locator(false),
  };
  await assert.rejects(completeAccountLogin(page, { market: 'cl', hostname: 'stg2.shop.samsung.com',
    credentials: {}, timeout: 1000, now: () => clock, pause: async ms => { clock += ms; }, log() {},
  }), error => error.exitCode === 79);
  assert.equal(fills, 0);
});
test('warm SSO does not attempt to find or fill an obsolete provider field', async () => {
  const s = scenario({ warm: true }); await s.run(); assert.deepEqual(s.calls, []);
});
test('insecure or foreign targets never receive credentials', async () => {
  let fills = 0;
  for (const url of ['http://account.samsung.com/accounts', 'https://foreign.example/accounts']) {
    const locator = { filter() { return this; }, first() { return this; }, fill: async () => fills++ };
    await assert.rejects(completeAccountLogin({ isClosed: () => false, url: () => url, locator: () => locator }, {
      market: 'pe', hostname: 'stg2.shop.samsung.com', credentials: {}, log() {},
    }));
  }
  assert.equal(fills, 0);
});
