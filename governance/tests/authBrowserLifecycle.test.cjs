const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureAuthBrowser } = require('../../utils/authBrowserLifecycle.cjs');
const { refreshAuth } = require('../../utils/authRefreshRunner.cjs');

for (const market of ['mx', 'pe', 'co', 'cl']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} captures exact dedicated browser, never a shared CDP port`, async () => {
    const events = [];
    const handle = await captureAuthBrowser({ market, environment, slot: 'second' }, {
      profilesRoot: '/fixture', readFile(file) { assert.ok(file.includes(`${environment.toLowerCase()}-${market}-second`)); return '43210\n/devtools/browser/fixture-id\n'; },
      chromium: { async connectOverCDP(endpoint) {
        assert.equal(endpoint, 'ws://127.0.0.1:43210/devtools/browser/fixture-id');
        return { isConnected: () => true, async newBrowserCDPSession() { return { async send(command) { events.push(command); } }; }, async close() { events.push('disconnect'); } };
      } },
    });
    assert.deepEqual(events, []);
    await handle.closeVerified(); await handle.dispose();
    assert.deepEqual(events, ['Browser.close', 'disconnect']);
  });
}

for (const failurePhase of [null, 'verify', 'package', 'publish']) {
  test(`browser closes only after every phase succeeds (${failurePhase || 'success'})`, async () => {
    const events = [];
    const pending = refreshAuth({ market: 'pe', environment: 'S2', env: { JENKINS_AUTH_PUBLISH: '1' }, publishScript: 'scripts/publish.cjs' }, {
      acquireMarket: () => () => {}, acquire: () => () => events.push('release'), log() {},
      async runChild(script) { const phase = script.match(/auth-(login|verify|package)/)?.[1] || 'publish'; events.push(phase); return phase === failurePhase ? 1 : 0; },
      async captureBrowser() { events.push('capture'); return { async closeVerified() { events.push('close'); }, async dispose() { events.push('disconnect'); } }; },
    });
    if (failurePhase) await assert.rejects(pending); else await pending;
    assert.equal(events.includes('close'), !failurePhase);
    if (!failurePhase) assert.ok(events.indexOf('close') > events.indexOf('publish'));
    assert.deepEqual(events.slice(-2), ['disconnect', 'release']);
  });
}

test('shared PreQA2 login does not capture or close any native browser', async () => {
  await refreshAuth({ market: 'co', environment: 'S2', env: { CO_STOREFRONT_URL: 'https://p6-pre-qa2.samsung.com/co/' } }, {
    acquireMarket: () => () => {}, acquire: () => () => {}, log() {}, runChild: async () => 0,
    captureBrowser() { throw new Error('must preserve shared Chrome'); },
  });
});
