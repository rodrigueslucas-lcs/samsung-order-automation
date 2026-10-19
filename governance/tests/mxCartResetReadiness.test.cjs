const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('tests/markets/mx/qst/base-store/mxQstFlows.js', 'utf8');
const body = source.slice(source.indexOf('export async function resetMxCartViaUi'), source.indexOf('async function normalizeControlledQuantity'))
  .replace('export ', '');

function scenario({ interrupted = false, failed = false } = {}) {
  const events = [];
  let states = 0;
  const confirm = { waitFor: async () => {}, click: async () => events.push('confirm') };
  const dialog = { or() { return this; }, filter() { return this; }, first() { return this; },
    waitFor: async () => {}, getByRole: () => ({ filter: () => ({ first: () => confirm }) }) };
  const page = {
    getByRole: role => role === 'main' ? { waitFor: async () => {} } : dialog,
    waitForResponse: async (_, options) => {
      assert.equal(options.timeout, 120000);
      events.push('listen');
      return { ok: () => !failed, finished: async () => { events.push('body'); return interrupted ? new Error('interrupted') : null; } };
    },
  };
  const reset = vm.runInNewContext(`${body}\nresetMxCartViaUi;`, {
    mxQstCart: () => ({ loadMxCartState: async () => { events.push('read'); return { productEntries: [] }; } }),
    waitForMxCartUiState: async () => states++ ? { kind: 'empty' } : {
      kind: 'removable', removeButtons: { first: () => ({ click: async () => events.push('remove') }) },
    },
    expect: value => ({ toBe: expected => assert.equal(value, expected) }),
    Error,
  });
  return { run: () => reset(page, {}), events };
}

test('MX setup waits for initial cart, a single UI deletion and its body before readback', async () => {
  const s = scenario();
  await s.run();
  assert.deepEqual(s.events, ['read', 'remove', 'listen', 'confirm', 'body', 'read', 'read']);
});

test('MX setup does not navigate or repeat a failed/ambiguous cart deletion', async () => {
  for (const options of [{ interrupted: true }, { failed: true }]) {
    const s = scenario(options);
    await assert.rejects(s.run());
    assert.equal(s.events.filter(e => e === 'confirm').length, 1);
    assert.equal(s.events.filter(e => e === 'read').length, 1);
  }
});
