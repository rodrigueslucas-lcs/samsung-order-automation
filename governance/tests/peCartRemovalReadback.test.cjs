const { test } = require('node:test');
const assert = require('node:assert/strict');
const { removePeEntryAndReadBack } = require('../../utils/peCartRemovalReadback.cjs');
const empty = { entries: [] };
const populated = { entries: [{ entryNumber: 0 }] };

test('a DELETE timeout can succeed only through positive cart readback without a second mutation', async () => {
  let deletes = 0, reads = 0;
  const cart = await removePeEntryAndReadBack({ remove: async () => {
    deletes++; throw Error('apiRequestContext.delete: Timeout 15000ms exceeded.');
  }, readCart: async () => ++reads === 1 ? populated : empty, entryNumber: 0, pause: async () => {} });
  assert.equal(cart, empty); assert.equal(deletes, 1); assert.equal(reads, 2);
});

test('an acknowledged DELETE still requires proof that the entry is absent', async () => {
  let deletes = 0;
  await assert.rejects(removePeEntryAndReadBack({ remove: async () => { deletes++; return { ok: () => true }; },
    readCart: async () => populated, entryNumber: 0, pause: async () => {}, attempts: 2 }), /no mutation was retried/);
  assert.equal(deletes, 1);
});

test('HTTP failures, readback failures and unrelated errors remain failures', async () => {
  for (const remove of [async () => ({ ok: () => false, status: () => 400 }),
    async () => { throw Error('authentication failed'); }]) {
    await assert.rejects(removePeEntryAndReadBack({ remove, readCart: async () => empty, entryNumber: 0, pause: async () => {} }));
  }
  await assert.rejects(removePeEntryAndReadBack({ remove: async () => ({ ok: () => true }),
    readCart: async () => { throw Error('JaloObjectNoLongerValidError'); }, entryNumber: 0, pause: async () => {} }), /JaloObjectNoLongerValidError/);
});
