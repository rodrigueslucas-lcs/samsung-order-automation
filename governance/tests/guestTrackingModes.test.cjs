const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadTracking(options = {}, url = 'https://stg.shop.samsung.com/co/mypage/orders') {
  const source = fs.readFileSync('pages/GuestOrderTrackingPage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default class GuestOrderTrackingPage', 'class GuestOrderTrackingPage');
  const Tracking = vm.runInNewContext(`${source}\nGuestOrderTrackingPage;`, {
    URL, BasePage: class { constructor(page) { this.page = page; } },
  });
  const locator = { locator() { return this; }, filter() { return this; }, first() { return this; }, getByRole() { return this; } };
  const page = { locator: () => locator, getByRole: () => locator, url: () => url };
  return new Tracking(page, options);
}

test('tracking keeps OTP by default for every market including CO S2', () => {
  for (const market of ['mx', 'pe', 'co', 'cl']) {
    assert.equal(loadTracking({ market, environment: 'S2' }).directOrderLookup, false);
  }
  assert.equal(loadTracking({ market: 'co', environment: 'S1', verificationMode: 'order-email' }).directOrderLookup, true);
});

test('direct lookup refuses other markets, S2 and unknown modes', () => {
  for (const options of [{ market: 'mx', environment: 'S1' }, { market: 'co', environment: 'S2' }, { market: 'co' }]) {
    assert.throws(() => loadTracking({ ...options, verificationMode: 'order-email' }), /supported only/);
  }
  assert.throws(() => loadTracking({ market: 'co', environment: 'S1', verificationMode: 'unknown' }), /supported only/);
});

test('direct lookup verifies the actual S1 CO origin and orders route', () => {
  const options = { market: 'co', environment: 'S1', verificationMode: 'order-email' };
  loadTracking(options).validateDirectLookupOrigin();
  for (const url of ['https://stg2.shop.samsung.com/co/mypage/orders', 'https://www.samsung.com/co/mypage/orders', 'https://stg.shop.samsung.com/pe/mypage/orders', 'https://stg.shop.samsung.com/co/cart']) {
    assert.throws(() => loadTracking(options, url).validateDirectLookupOrigin(), /verified CO S1 orders page/);
  }
});

test('OTP and direct lookup methods cannot be interchanged', async () => {
  const direct = loadTracking({ market: 'co', environment: 'S1', verificationMode: 'order-email' });
  await assert.rejects(direct.requestVerificationCode(), /not the OTP request/);
  await assert.rejects(direct.submitVerificationCode(), /must not submit an OTP/);
  await assert.rejects(loadTracking({ market: 'co', environment: 'S2' }).lookupOrderByEmail(), /requires OTP/);
});
