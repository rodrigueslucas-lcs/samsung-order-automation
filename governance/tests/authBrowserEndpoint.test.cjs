const test = require('node:test');
const assert = require('node:assert/strict');
const { recoverAuthBrowserEndpoint } = require('../../utils/authBrowserEndpoint.cjs');

const folder = require('node:path').resolve('/fixture/s2-mx-qa');
const owner = { pid: 1234, createdAt: '2026-11-16T12:00:00Z', ports: [43210] };
const snapshot = () => ({ known: true, browsers: [{ ...owner }] });
const response = (url = 'ws://127.0.0.1:43210/devtools/browser/owned-id') => ({ ok: true,
  json: async () => ({ Browser: 'Chrome/156.0', webSocketDebuggerUrl: url }) });

test('stale CDP metadata recovers the exact live profile listener and repairs the shared pointer', async () => {
  const writes = []; let probes = 0;
  const result = await recoverAuthBrowserEndpoint(folder, { platform: 'win32', probe: () => { probes++; return snapshot(); },
    request: async (url, options) => { assert.equal(url, 'http://127.0.0.1:43210/json/version'); assert.equal(options.redirect, 'error'); return response(); },
    write: (...args) => writes.push(args),
  });
  assert.equal(probes, 2);
  assert.deepEqual(result, { occupied: true, endpoint: 'ws://127.0.0.1:43210/devtools/browser/owned-id' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], '43210\n/devtools/browser/owned-id\n');
});
test('a positively absent profile can launch normally', async () => {
  assert.deepEqual(await recoverAuthBrowserEndpoint(folder, { platform: 'win32', probe: () => ({ known: true, browsers: [] }),
    request: () => assert.fail('no listener to inspect'), write: () => assert.fail('no pointer to repair') }), { occupied: false, absent: true });
});
for (const [name, state] of [['unknown owner', { known: false }], ['multiple owners', { known: true, browsers: [owner, owner] }],
  ['live owner without listener', { known: true, browsers: [{ ...owner, ports: [] }] }]]) {
  test(name + ' cannot authorize a duplicate window', async () => {
    await assert.rejects(recoverAuthBrowserEndpoint(folder, { platform: 'win32', probe: () => state,
      write: () => assert.fail('unproven metadata') }), error => error.exitCode === 73);
  });
}
for (const url of ['ws://remote.example:43210/devtools/browser/owned-id', 'ws://127.0.0.1:12345/devtools/browser/owned-id',
  'ws://127.0.0.1:43210/devtools/page/other', 'ws://127.0.0.1:43210/devtools/browser/id?token=fixture']) {
  test('rejects unrelated debugger endpoint ' + url, async () => {
    await assert.rejects(recoverAuthBrowserEndpoint(folder, { platform: 'win32', probe: snapshot, request: async () => response(url),
      write: () => assert.fail('cannot overwrite with unrelated endpoint') }), error => error.code === 'AUTH_BROWSER_ENDPOINT_UNAVAILABLE');
  });
}
test('process/port replacement during discovery is rejected', async () => {
  let count = 0;
  await assert.rejects(recoverAuthBrowserEndpoint(folder, { platform: 'win32', probe: () => ++count === 1 ? snapshot() :
    { known: true, browsers: [{ ...owner, createdAt: 'later-process' }] }, request: async () => response(),
  write: () => assert.fail('PID was reused') }), error => error.exitCode === 73);
});
test('pointer write errors remain errors and do not authorize another launch', async () => {
  await assert.rejects(recoverAuthBrowserEndpoint(folder, { platform: 'win32', probe: snapshot, request: async () => response(),
    write: () => { throw Object.assign(Error('fixture'), { code: 'EACCES' }); } }), error => error.code === 'EACCES');
});

test('real Windows Chrome with stale pointer reconnects without opening another window', { skip: process.platform !== 'win32' }, async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { chromium } = require('@playwright/test');
  const { connectAuthBrowser } = require('../../utils/authDedicatedBrowser.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-endpoint-regression-'));
  const profile = path.join(root, 's2-mx-qa');
  let context, attached;
  try {
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, args: ['--remote-debugging-port=0'] });
    const file = path.join(profile, 'DevToolsActivePort');
    const actual = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, '1\n/devtools/browser/stale-pointer\n');
    attached = await connectAuthBrowser({ chromium, profileDir: profile, market: 'mx', environment: 'S2' }, {
      hasWindow: async browser => browser.contexts()[0].pages().length > 0,
      launch: () => assert.fail('must recover the existing Chrome, never open another window'), log() {},
    });
    assert.equal(fs.readFileSync(file, 'utf8').trim(), actual.trim());
    assert.equal(attached.contexts()[0].pages().length, 1);
  } finally {
    await attached?.close();
    await context?.close();
    await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('real Windows relaunch clears a dead profile pointer before Chrome starts', { skip: process.platform !== 'win32' }, async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { chromium } = require('@playwright/test');
  const { connectAuthBrowser } = require('../../utils/authDedicatedBrowser.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-endpoint-relaunch-'));
  const profile = path.join(root, 's2-co-qa'); fs.mkdirSync(profile);
  const file = path.join(profile, 'DevToolsActivePort');
  fs.writeFileSync(file, '1\n/devtools/browser/dead-browser\n');
  let pending, context, attached, launches = 0;
  try {
    attached = await connectAuthBrowser({ chromium, profileDir: profile, market: 'co', environment: 'S2' }, {
      hasWindow: async browser => browser.contexts()[0].pages().length > 0, log() {},
      launch: () => {
        launches++;
        assert.equal(fs.existsSync(file), false, 'dead pointer must be cleared before launch');
        pending = chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, args: ['--remote-debugging-port=0'] });
        pending.catch(() => {});
        return { status: 0 };
      },
    });
    context = await pending;
    assert.equal(launches, 1);
    assert.notEqual(fs.readFileSync(file, 'utf8').split(/\r?\n/)[0], '1');
  } finally {
    await attached?.close();
    if (!context && pending) context = await pending.catch(() => null);
    await context?.close();
    await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
