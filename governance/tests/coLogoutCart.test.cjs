const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const moduleBox = { exports: {} };
vm.runInNewContext(fs.readFileSync('flows/co/logoutCart.cjs', 'utf8'), {
  URL, module: moduleBox,
  require: () => ({ expect: target => ({ toHaveCount: async expected => assert.equal(await target.count(), expected) }) }),
});
const { logoutCoCartAndValidateSignedOut: run } = moduleBox.exports;

function scenario({ environment = 'S2', bodyGate, status = 302, returnStatus = 200,
  interrupted = false, menuFailures = 0, stillLoggedIn = false } = {}) {
  const origin = `https://${environment === 'S1' ? 'stg' : 'stg2'}.shop.samsung.com`;
  const events = [];
  let listeners = 0, openings = 0, clicks = 0;
  const response = (path, navigation = false, host = origin, method = 'GET') => ({
    url: () => host + path,
    request: () => ({ method: () => method, isNavigationRequest: () => navigation }),
  });
  const chain = extra => ({ filter() { return this; }, first() { return this; }, last() { return this; }, ...extra });
  const signIn = chain({ waitFor: async () => { if (stillLoggedIn || openings <= menuFailures) throw Error('menu not ready'); } });
  const menu = chain({ locator: () => signIn, getByText: () => ({ count: async () => Number(stillLoggedIn) }) });
  const page = {
    waitForResponse: async predicate => {
      const isReturn = listeners++ === 1;
      const path = isReturn ? '/co/cart' : '/co/logout';
      events.push(isReturn ? 'listen-return' : 'listen-logout');
      assert.equal(predicate(response(path, isReturn)), true);
      assert.equal(predicate(response(path, isReturn, 'https://foreign.example')), false);
      assert.equal(predicate(response(path, isReturn, origin, 'POST')), false);
      if (isReturn) assert.equal(predicate(response(path, false)), false);
      return {
        status: () => isReturn ? returnStatus : status,
        finished: async () => {
          events.push(isReturn ? 'return-body' : 'logout-body');
          if (isReturn) await bodyGate;
          return interrupted ? new Error('aborted') : null;
        },
      };
    },
    waitForURL: async () => events.push('returned-url'),
    keyboard: { press: async () => events.push('escape') }, mouse: { move: async () => events.push('move-away') },
    getByRole: () => ({ waitFor: async () => {}, hover: async () => { openings++; events.push('hover'); } }),
    locator: () => menu,
  };
  const logout = { press: async key => { assert.equal(key, 'Enter'); clicks++; events.push('activate'); } };
  return { run: () => run(page, { cartUrl: origin + '/co/cart' }, logout),
    state: () => ({ events, openings, clicks }) };
}

test('CO S1/S2 waits for actual logout and returned cart document before hover', async () => {
  for (const environment of ['S1', 'S2']) {
    const s = scenario({ environment });
    const result = await s.run();
    assert.equal(result.logoutStatus, 302);
    assert.equal(s.state().clicks, 1);
    assert.ok(s.state().events.indexOf('hover') > s.state().events.indexOf('return-body'));
  }
});

test('same cart URL does not release the logout flow while its new document is pending', async () => {
  let release;
  const s = scenario({ bodyGate: new Promise(resolve => { release = resolve; }) });
  const pending = s.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.state().openings, 0);
  release();
  await pending;
});

test('CO menu hydration can reopen without repeating logout', async () => {
  const s = scenario({ menuFailures: 1 });
  const result = await s.run();
  assert.equal(result.menuAttempts, 2);
  assert.equal(s.state().clicks, 1);
});

test('CO errors and interrupted logout/return fail without another logout', async () => {
  for (const options of [{ status: 500 }, { returnStatus: 503 }, { interrupted: true }]) {
    const s = scenario(options);
    await assert.rejects(s.run(), /logout was not retried/);
    assert.equal(s.state().clicks, 1);
    assert.equal(s.state().openings, 0);
  }
});

test('CO still requires positive signed-out proof and bounds menu openings', async () => {
  const s = scenario({ stillLoggedIn: true });
  await assert.rejects(s.run(), /signed-out profile action was not proven/);
  assert.equal(s.state().openings, 3);
  assert.equal(s.state().clicks, 1);
});

test('CO logout refuses production and foreign market carts before any action', async () => {
  for (const cartUrl of ['https://www.samsung.com/co/cart', 'https://stg2.shop.samsung.com/pe/cart']) {
    await assert.rejects(run({}, { cartUrl }, {}), /restricted/);
  }
});
