const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { refreshAuth, runAuthChild, acquireRefreshLock } = require('../../utils/authRefreshRunner.cjs');

async function scenario({ market = 'mx', environment = 'S2', slot = 'primary', statuses = [0, 0, 0], manual = false, publish = false } = {}) {
  const calls = [], output = []; let released = 0;
  const env = { [`${market.toUpperCase()}_AUTH_MANUAL`]: manual ? '1' : '0', JENKINS_AUTH_PUBLISH: publish ? '1' : '0' };
  const result = refreshAuth({ market, environment, slot, env, publishScript: `publish-${market}` }, {
    log: line => output.push(line), acquireMarket: () => () => {}, acquire: () => () => released++,
    captureBrowser: async () => null,
    runChild: async (script, actualEnv, options) => { calls.push({ script, env: actualEnv, options }); return statuses.shift() ?? 0; },
  });
  let error; try { await result; } catch (failure) { error = failure; }
  return { calls, output: output.join('\n'), released, error };
}

for (const market of ['mx', 'pe', 'co', 'cl']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} READY requires login, fresh verification and packaging`, async () => {
    const s = await scenario({ market, environment });
    assert.equal(s.error, undefined); assert.equal(s.released, 1);
    assert.deepEqual(s.calls.map(x => x.script), [`scripts/auth-login-${market}.cjs`, `scripts/auth-verify-${market}.cjs`, `scripts/auth-package-${market}.cjs`]);
    assert.equal(s.calls[1].env[`${market.toUpperCase()}_AUTH_AUTO_RENEW`], '0');
    assert.match(s.output, /READY/); assert.doesNotMatch(s.output, /attempt 1\/3/);
  });
}

for (const status of [1, 20, 73, 78]) test(`exit ${status} stops without blind login retries or false READY`, async () => {
  const s = await scenario({ statuses: [status] });
  assert.ok(s.error); assert.equal(s.calls.length, 1); assert.equal(s.released, 1);
  assert.doesNotMatch(s.output, /READY/);
});

test('only a lost browser may reconnect once; repeated loss is bounded', async () => {
  const recovered = await scenario({ statuses: [75, 0, 0, 0] });
  assert.equal(recovered.error, undefined); assert.equal(recovered.calls.length, 4);
  const repeated = await scenario({ statuses: [75, 75] });
  assert.ok(repeated.error); assert.equal(repeated.calls.length, 2);
});

test('manual/second-account verification never restarts the login', async () => {
  const s = await scenario({ slot: 'second', manual: true, statuses: [75] });
  assert.ok(s.error); assert.equal(s.calls.length, 1); assert.doesNotMatch(s.output, /READY/);
});

test('human verification stops before verify/package without a false READY', async () => {
  const s = await scenario({ statuses: [79] });
  assert.equal(s.error.code, 'AUTH_HUMAN_REQUIRED');
  assert.equal(s.calls.length, 1); assert.doesNotMatch(s.output, /READY/);
});

test('a rejected verified session cannot be packaged or published', async () => {
  const s = await scenario({ statuses: [0, 20], publish: true });
  assert.ok(s.error); assert.equal(s.calls.length, 2); assert.doesNotMatch(s.output, /READY/);
});

for (const market of ['mx', 'pe', 'co', 'cl']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} operator forwards environment and supported identity slot to every phase`, async () => {
    const calls = [], pending = [];
    const upper = market.toUpperCase();
    const runtime = { env: { [`${upper}_QST_ENVIRONMENT`]: environment, [`${upper}_AUTH_SLOT`]: market === 'pe' ? 'primary' : 'second' }, exitCode: 0 };
    vm.runInNewContext(fs.readFileSync(`scripts/auth-refresh-${market}.cjs`, 'utf8'), {
      process: runtime, console: { log() {}, error() {} }, require: name => {
        assert.equal(name, '../utils/authRefreshRunner.cjs');
        return { refreshAuth: options => { const work = refreshAuth(options, {
          acquireMarket: () => () => {}, acquire: () => () => {}, log() {}, captureBrowser: async () => null, runChild: async (script, env) => { calls.push({ script, env }); return 0; },
        }); pending.push(work); return work; } };
      },
    });
    await Promise.all(pending);
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.env[`${upper}_QST_ENVIRONMENT`], environment);
      assert.equal(call.env[`${upper}_AUTH_SLOT`], market === 'pe' ? 'primary' : 'second');
      if (market !== 'pe') assert.equal(call.env[`${upper}_AUTH_MANUAL`], '1');
    }
  });
}

test('same market/env/slot cannot run two refresh pipelines concurrently', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-refresh-lock-'));
  let release;
  try {
    release = acquireRefreshLock('mx', 'S2', 'second', directory);
    assert.throws(() => acquireRefreshLock('mx', 'S2', 'second', directory), /already active/);
    const other = acquireRefreshLock('mx', 'S1', 'second', directory); other();
    release(); release = acquireRefreshLock('mx', 'S2', 'second', directory);
  } finally { release?.(); fs.rmdirSync(directory); }
});

test('a silent child emits progress and its watchdog bounds stalled startup', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-refresh-child-'));
  const file = path.join(directory, 'child.cjs');
  fs.writeFileSync(file, 'setTimeout(() => process.exit(0), 150);');
  try {
    const output = [];
    assert.equal(await runAuthChild(file, process.env, { label: 'fixture', log: line => output.push(line), timeoutMs: 60000, heartbeatMs: 50 }), 0);
    assert.ok(output.some(line => /active/.test(line)));
    fs.writeFileSync(file, 'setInterval(() => {}, 1000);');
    await assert.rejects(runAuthChild(file, process.env, { label: 'fixture', log() {}, timeoutMs: 100, heartbeatMs: 50 }), /bounded wait/);
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory); }
});
