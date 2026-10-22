const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openPeOrderHistory } = require('../../flows/pe/orderHistory.cjs');

function fixture({ blank = false, alwaysBlank = false, renderedError = false, apiStatus = 200, documentStatus = 200, environment = 'S2' } = {}) {
  const origin = environment === 'S2' ? 'https://stg2.shop.samsung.com' : 'https://stg.shop.samsung.com';
  const calls = [];
  let current = origin + '/pe/', recoveries = 0, predicate, resolve;
  const history = { currentOrders: [], previousOrders: [] };
  const response = (host = `${environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`, method = 'GET') => ({
    url: () => `https://${host}/tokocommercewebservices/v2/pe/users/current/orders`,
    request: () => ({ method: () => method }), status: () => apiStatus, json: async () => history,
  });
  const page = {
    url: () => current,
    waitForResponse: (check, options) => {
      assert.equal(options.timeout, 75000); predicate = check;
      return new Promise(r => { resolve = r; });
    },
    goto: async (url, options) => {
      assert.ok(predicate, 'observe before navigation');
      assert.equal(options.waitUntil, 'commit'); assert.equal(options.timeout, 15000);
      calls.push(url); current = url;
      return { ok: () => documentStatus === 200, status: () => documentStatus };
    },
    locator: () => ({ innerText: async () => renderedError ? 'Session expired' : '' }),
    getByRole: () => ({ first: () => ({ waitFor: async () => {
      if (alwaysBlank || renderedError || (blank && calls.length === 1)) {
        const error = new Error('heading timeout'); error.name = 'TimeoutError'; throw error;
      }
      assert.equal(predicate(response('production.example')), false);
      assert.equal(predicate(response(undefined, 'POST')), false);
      assert.equal(predicate(response(environment === 'S2' ? 's1-smb-api-cdn.ecom-stg.samsung.com' : 's2-smb-api-cdn.ecom-stg.samsung.com')), false);
      assert.equal(predicate(response()), true); resolve(response());
    } }) }),
  };
  const myOrders = { origin, routes: { orders: '/pe/mypage/orders' }, assertStagingUrl: () => {
    assert.equal(new URL(current).origin, origin);
  } };
  return { run: () => openPeOrderHistory(page, myOrders, { onRecovery: () => recoveries++ }),
    state: () => ({ calls, recoveries }), myOrders };
}

for (const environment of ['S1', 'S2']) test(`PE ${environment} requires matching history API and page`, async () => {
  const s = fixture({ environment });
  assert.deepEqual(await s.run(), { currentOrders: [], previousOrders: [] });
  assert.equal(s.state().calls.length, 1); assert.equal(s.state().recoveries, 0);
});

test('blank committed document recovers once with a fresh GET before API proof', async () => {
  const s = fixture({ blank: true }); await s.run();
  assert.equal(s.state().calls.length, 2); assert.equal(s.state().recoveries, 1);
  assert.ok(new URL(s.state().calls[1]).searchParams.has('_qa_history_reload'));
});

test('persistent blank page fails after one recovery', async () => {
  const s = fixture({ alwaysBlank: true }); await assert.rejects(s.run(), /heading timeout/);
  assert.equal(s.state().calls.length, 2);
});

test('rendered auth/error page is never retried as blank', async () => {
  const s = fixture({ renderedError: true }); await assert.rejects(s.run(), /heading timeout/);
  assert.equal(s.state().calls.length, 1);
});

test('rejected history API and document HTTP errors remain failures', async () => {
  await assert.rejects(fixture({ apiStatus: 401 }).run(), /API failed: HTTP 401/);
  const s = fixture({ documentStatus: 503 }); await assert.rejects(s.run(), /document failed: HTTP 503/);
  assert.equal(s.state().calls.length, 1);
});

test('other markets and production cannot use this recovery', async () => {
  for (const override of [{ origin: 'https://shop.samsung.com' }, { routes: { orders: '/co/mypage/orders' } }]) {
    const s = fixture(); Object.assign(s.myOrders, override);
    await assert.rejects(s.run(), /outside PE staging/);
  }
});
