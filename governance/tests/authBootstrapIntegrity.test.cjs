const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthState } = require('../../utils/authState');

function scenario({ failures = 1, blank = true, truncated = true, status = 200, signedOut = false, foreign = false } = {}) {
  let setupCalls = 0, url = 'about:blank', logoutChecks = 0;
  const navigations = [], cdp = [];
  const marker = { waitFor: async () => { if (setupCalls <= failures) throw Error('access marker absent'); } };
  const logout = { waitFor: async () => { logoutChecks++; if (signedOut) throw Error('logout absent'); } };
  const chain = value => ({ filter() { return this; }, last() { return this; }, ...value });
  const page = {
    context: () => ({ newCDPSession: async () => ({ send: async method => cdp.push(method) }) }),
    goto: async target => {
      url = foreign ? 'https://foreign.example/' : target;
      navigations.push(target);
      if (target.endsWith('getcookie.html')) setupCalls++;
      return { ok: () => status === 200, text: async () => truncated ? '<html><body>' : '<html><body></body></html>' };
    },
    url: () => url, keyboard: { press: async () => {} },
    locator: () => ({ innerText: async () => blank ? '' : 'Page Under Maintenance' }),
    getByRole: () => ({ waitFor: async () => {}, click: async () => {} }),
    getByText: name => /You can access/.test(String(name)) ? marker
      : /SystemParking/.test(String(name)) ? { count: async () => 0 } : chain(logout),
  };
  const auth = createAuthState({ authStatePath: 'test-results/unused-auth.json', sessionStoragePath: 'test-results/unused-session.json',
    hostname: 'stg2.shop.samsung.com', setupUrl: 'https://stg2.shop.samsung.com/getcookie.html',
    validationUrl: 'https://stg2.shop.samsung.com/pe/', label: 'S2 PE', refreshInstruction: 'Refresh PE.' });
  return { run: () => auth.validateAuthenticatedSession(page), state: () => ({ setupCalls, navigations, cdp, logoutChecks }) };
}

test('auth recovers one blank truncated bootstrap then still requires positive logout proof', async () => {
  const s = scenario(); await s.run();
  assert.equal(s.state().setupCalls, 2);
  assert.equal(s.state().logoutChecks, 1);
  assert.deepEqual(s.state().cdp, ['Network.enable', 'Network.setCacheDisabled']);
});

test('auth never accepts a bootstrap marker as proof of a signed-in session', async () => {
  const s = scenario({ signedOut: true });
  await assert.rejects(s.run(), /authenticated logout control was not rendered/);
});

test('auth does not loop on persistent truncation or retry maintenance/HTTP failures', async () => {
  for (const options of [{ failures: 2 }, { blank: false }, { truncated: false }, { status: 503 }]) {
    const s = scenario(options);
    await assert.rejects(s.run(), /bootstrap did not render/);
    assert.equal(s.state().setupCalls, options.failures === 2 ? 2 : 1);
    assert.equal(s.state().logoutChecks, 0);
  }
});

test('auth rejects a foreign bootstrap destination before retry or profile actions', async () => {
  const s = scenario({ foreign: true });
  await assert.rejects(s.run(), /Unexpected S2 PE setup host/);
  assert.equal(s.state().setupCalls, 1);
  assert.equal(s.state().logoutChecks, 0);
});
