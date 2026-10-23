const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { connectAuthBrowser } = require('../../utils/authDedicatedBrowser.cjs');

for (const market of ['mx', 'pe', 'co', 'cl']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} reuses its exact dedicated CDP profile without another launcher`, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-cdp-'));
    const directory = path.join(root, `${environment.toLowerCase()}-${market}-second`); fs.mkdirSync(directory);
    const port = path.join(directory, 'DevToolsActivePort'); fs.writeFileSync(port, '12345\n');
    const browser = {};
    try {
      const result = await connectAuthBrowser({ market, environment, slot: 'second', profileDir: directory,
        chromium: { connectOverCDP: async (url, options) => { assert.equal(url, 'http://127.0.0.1:12345'); assert.equal(options.timeout, 5000); return browser; } },
      }, { hasWindow: async () => true, launch: () => assert.fail('must not relaunch an existing browser'), log() {} });
      assert.equal(result, browser);
    } finally { fs.unlinkSync(port); fs.rmdirSync(directory); fs.rmdirSync(root); }
  });
}

test('an onboarding/background-only browser opens a native window without deleting identity', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-cdp-'));
  const directory = path.join(root, 's2-co-qa'); fs.mkdirSync(directory);
  const port = path.join(directory, 'DevToolsActivePort'); fs.writeFileSync(port, '12345\n');
  let opened = false;
  const browser = {};
  try {
    assert.equal(await connectAuthBrowser({ market: 'co', environment: 'S2', profileDir: directory, chromium: { connectOverCDP: async () => browser } }, {
      hasWindow: async () => opened, launch: () => { opened = true; return { status: 0 }; }, log() {},
    }), browser);
    assert.equal(fs.readFileSync(port, 'utf8'), '12345\n');
  } finally { fs.unlinkSync(port); fs.rmdirSync(directory); fs.rmdirSync(root); }
});

test('wrong market/slot profile is rejected before connecting or launching', async () => {
  await assert.rejects(connectAuthBrowser({ market: 'mx', environment: 'S2', slot: 'second', profileDir: '/fixture/s2-mx-qa', chromium: {} }), /does not match/);
});

test('a transient CDP timeout retains the live endpoint for a later reconnect', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-cdp-'));
  const directory = path.join(root, 's2-cl-qa'); fs.mkdirSync(directory);
  const port = path.join(directory, 'DevToolsActivePort'); fs.writeFileSync(port, '12345\n');
  let clock = 0;
  try {
    await assert.rejects(connectAuthBrowser({ market: 'cl', environment: 'S2', profileDir: directory,
      chromium: { connectOverCDP: async () => { throw Error('temporarily busy'); } },
    }, { launch: () => ({ status: 0 }), now: () => clock, pause: async ms => { clock += ms; }, log() {} }), error => error.exitCode === 73);
    assert.equal(fs.readFileSync(port, 'utf8'), '12345\n');
  } finally { fs.unlinkSync(port); fs.rmdirSync(directory); fs.rmdirSync(root); }
});
