const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthState } = require('../../utils/authState');

function scenario({ flicker = false, signedOut = false, logoutVisible = true, attempts = 2, market = 'CO' } = {}) {
  let openings = 0;
  let readyChecks = 0;
  let logoutChecks = 0;
  const moves = [];
  const locator = extra => ({ filter() { return this; }, last() { return this; }, first() { return this; }, ...extra });
  const login = locator({ isVisible: async () => signedOut, count: async () => Number(signedOut) });
  const logout = locator({ waitFor: async () => { logoutChecks++; if (!logoutVisible) throw new Error('no logout'); } });
  const ready = locator({
    waitFor: async () => {
      if (flicker && openings === 1 && readyChecks++ > 0) throw new Error('menu closed during hydration');
    },
    isVisible: async () => true,
  });
  const menu = locator({ getByText: () => logout, locator: () => login });
  const profile = locator({ waitFor: async () => {}, hover: async () => { openings++; }, click: async () => { throw new Error('must not toggle an open menu'); } });
  const page = {
    url: () => `https://stg.shop.samsung.com/${market.toLowerCase()}/`,
    mouse: { move: async (x, y) => moves.push([x, y]) }, keyboard: { press: async () => {} },
    getByRole: () => profile,
    locator: selector => selector === 'menu-ready' ? ready : menu,
  };
  const auth = createAuthState({
    authStatePath: 'test-results/unused-auth.json', sessionStoragePath: 'test-results/unused-session.json',
    hostname: 'stg.shop.samsung.com', validationUrl: page.url(), label: `S1 ${market}`, refreshInstruction: `Refresh ${market} safely.`,
    profileMenuTrigger: 'hover', authenticatedMenuSelector: 'profile-menu', profileMenuReadySelector: 'menu-ready',
    profileMenuOpenAttempts: attempts,
  });
  return { validate: () => auth.validateCurrentPageAuthenticated(page), counts: () => ({ openings, logoutChecks, moves }) };
}

test('CO reopens a menu that closes between checks and still proves logout', async () => {
  const state = scenario({ flicker: true });
  await state.validate();
  assert.deepEqual(state.counts(), { openings: 2, logoutChecks: 1, moves: [[0, 0], [0, 0]] });
});

test('other callers keep the default single-opening behavior', async () => {
  const state = scenario({ flicker: true, attempts: 1 });
  await assert.rejects(state.validate(), /profile menu did not open/);
  assert.equal(state.counts().openings, 1);
});

test('signed-out profile fails immediately without retrying or accepting menu visibility as identity', async () => {
  const state = scenario({ signedOut: true });
  await assert.rejects(state.validate(), /session is signed out/);
  assert.equal(state.counts().openings, 1);
  assert.equal(state.counts().logoutChecks, 0);
});

test('an open menu without logout never passes and reopening is bounded', async () => {
  const state = scenario({ logoutVisible: false });
  await assert.rejects(state.validate(), /authenticated logout control was not rendered/);
  assert.equal(state.counts().openings, 2);
});

test('CL hydration can close the hovered menu without requiring a toggling click or navigation', async () => {
  const state = scenario({ market: 'CL', flicker: true, attempts: 3 });
  await state.validate();
  assert.equal(state.counts().openings, 2);
  assert.equal(state.counts().logoutChecks, 1);
});

test('CL signed-out sessions fail immediately despite available menu reopen attempts', async () => {
  const state = scenario({ market: 'CL', signedOut: true, attempts: 3 });
  await assert.rejects(state.validate(), /session is signed out/);
  assert.equal(state.counts().openings, 1);
  assert.equal(state.counts().logoutChecks, 0);
});

test('CL missing logout remains a failure after the bounded reopen limit', async () => {
  const state = scenario({ market: 'CL', logoutVisible: false, attempts: 3 });
  await assert.rejects(state.validate(), /authenticated logout control was not rendered/);
  assert.equal(state.counts().openings, 3);
});
