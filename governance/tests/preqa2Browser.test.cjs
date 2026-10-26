const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { launchConfiguration, connectPreqa2Browser } = require('../../utils/preqa2Browser.cjs');

test('native launcher exposes only loopback 9223 with the dedicated profile and maximized GUI', () => {
  const c = launchConfiguration('test-results/preqa-browser', { platform: 'win32', env: {}, exists: () => true });
  assert.ok(c.args.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(c.args.includes('--remote-debugging-port=9223'));
  assert.ok(c.args.includes('--start-maximized'));
  assert.ok(c.args.includes(`--user-data-dir=${path.resolve('test-results/preqa-browser')}`));
  assert.ok(!c.args.some(arg => /auto-open-devtools|no-sandbox|headless|password|token/.test(arg)));
});

test('an existing CDP context is reused without launching or closing Chrome', async () => {
  const browser = { contexts: () => [{}] };
  assert.equal(await connectPreqa2Browser({ chromium: { connectOverCDP: async () => browser } }, { launch: () => assert.fail('must not launch') }), browser);
});

test('missing default endpoint launches once and remains detached after connection', async () => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preqa-browser-test-'));
  let calls = 0, launches = 0, detached = false;
  const browser = { contexts: () => [{}], close: () => assert.fail('must preserve native browser') };
  const child = new EventEmitter(); child.unref = () => { detached = true; };
  try {
    const result = await connectPreqa2Browser({ profileDir, chromium: { connectOverCDP: async () => { if (++calls === 1) throw Error('ECONNREFUSED'); return browser; } } }, {
      configuration: () => ({ executable: 'chrome', args: [] }),
      launch: (executable, args, options) => { launches++; assert.equal(options.detached, true); assert.equal(options.windowsHide, true); return child; },
    });
    assert.equal(result, browser); assert.equal(launches, 1); assert.ok(detached);
  } finally { fs.rmdirSync(profileDir); }
});

test('unavailable explicit/custom endpoint never launches a fallback browser', async () => {
  for (const options of [{ endpoint: 'http://127.0.0.1:9444' }, { launchIfMissing: false }]) {
    await assert.rejects(connectPreqa2Browser({ ...options, chromium: { connectOverCDP: async () => { throw Error('unavailable'); } } }, { launch: () => assert.fail('no fallback') }), /no alternate profile/);
  }
});

test('a profile without an accessible port is not killed, deleted, or repeatedly relaunched', async () => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preqa-browser-test-'));
  let time = 0, launches = 0;
  const child = new EventEmitter(); child.unref = () => {};
  try {
    await assert.rejects(connectPreqa2Browser({ profileDir, chromium: { connectOverCDP: async () => { throw Error('unavailable'); } } }, {
      configuration: () => ({ executable: 'chrome', args: [] }), launch: () => { launches++; return child; }, now: () => time, pause: async () => { time += 10000; },
    }), /profile may already be occupied/);
    assert.equal(launches, 1); assert.ok(fs.existsSync(profileDir));
  } finally { fs.rmdirSync(profileDir); }
});
