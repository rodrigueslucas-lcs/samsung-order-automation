const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('pages/BackOfficePage.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '');
const BackOfficePage = vm.runInNewContext(`${source}\nBackOfficePage;`, { BasePage: class {}, URL, process });

function scenario({ status = 200, failedBody = false, actionFails = false, timeout = 30000 } = {}) {
  const events = [];
  let listener, resolveResponse, predicate;
  const request = (host, method = 'POST') => ({ method: () => method, url: () => `https://${host}/backoffice/zkau` });
  const actual = request('bo-s2.example');
  const old = request('bo-s2.example');
  const bo = Object.create(BackOfficePage.prototype);
  bo.url = 'https://bo-s2.example/backoffice/';
  bo.page = {
    locator: selector => ({ waitFor: async ({ state, timeout: actualTimeout }) => { assert.equal(actualTimeout, timeout); assert.equal(selector, '#zk_proc'); assert.equal(state, 'hidden'); events.push('ui-ready'); } }),
    on: (_, callback) => { listener = callback; },
    off: (_, callback) => { assert.equal(callback, listener); events.push('listener-removed'); },
    waitForResponse: (check, options) => { assert.equal(options.timeout, timeout); predicate = check; return new Promise(resolve => { resolveResponse = resolve; }); },
  };
  const action = async () => {
    assert.equal(predicate({ request: () => old }), false, 'Ignore a response initiated before the action.');
    const foreign = request('foreign.example'); listener(foreign);
    assert.equal(predicate({ request: () => foreign }), false, 'Ignore a different BackOffice origin.');
    listener(actual);
    const response = { request: () => actual, ok: () => status === 200, status: () => status,
      finished: async () => { events.push('body-finished'); return failedBody ? new Error('body failed') : null; } };
    assert.equal(predicate(response), true);
    resolveResponse(response);
    if (actionFails) throw new Error('action failed');
  };
  return { run: () => bo.waitForZkUpdate(action, { timeout }), events };
}

test('slow read-only queries retain one action and the explicit response/UI deadline', async () => {
  const s = scenario({ timeout: 90000 });
  await s.run();
  assert.deepEqual(s.events, ['ui-ready', 'body-finished', 'ui-ready', 'listener-removed']);
});

test('BO tree native click and navigation AU share the bounded mask recovery budget', async () => {
  const bo = Object.create(BackOfficePage.prototype);
  let clicks = 0, updates = 0;
  bo.waitForZkReady = async () => {};
  bo.page = { getByRole: () => ({ waitFor: async () => {}, click: async options => {
    assert.equal(options.timeout, 90000); clicks++;
  } }) };
  bo.waitForZkUpdate = async (action, options) => { assert.equal(options.timeout, 90000); updates++; await action(); };
  await bo.openTreeRow('Order');
  assert.equal(clicks, 1); assert.equal(updates, 1);
});

test('BO waits for the initiated AU body and unblocked UI, ignoring unrelated responses', async () => {
  const s = scenario(); await s.run();
  assert.deepEqual(s.events, ['ui-ready', 'body-finished', 'ui-ready', 'listener-removed']);
});

for (const [options, pattern] of [[{ status: 500 }, /HTTP 500/], [{ failedBody: true }, /did not finish/], [{ actionFails: true }, /action failed/]]) {
  test(`BO propagates update failure and removes its listener: ${pattern}`, async () => {
    const s = scenario(options); await assert.rejects(s.run(), pattern);
    assert.equal(s.events.at(-1), 'listener-removed');
    assert.equal(s.events.filter(e => e === 'ui-ready').length, 1);
  });
}
