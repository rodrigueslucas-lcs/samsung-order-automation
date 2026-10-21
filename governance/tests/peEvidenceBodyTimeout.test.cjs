const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serializeExchange, captureBusinessExchange } = require('../../utils/peBusinessEvidence.cjs');

function response(text) {
  return { text, headers: () => ({ 'content-type': 'application/json' }), status: () => 200, ok: () => true,
    request: () => ({ method: () => 'GET', url: () => 'https://stg2.shop.samsung.com/pe/cart?token=SECRET',
      headers: () => ({}), postData: () => null }) };
}

test('a stalled evidence body is bounded without losing safe response metadata', async () => {
  const value = await serializeExchange(response(() => new Promise(() => {})), { bodyTimeoutMs: 5 });
  assert.equal(value.status, 200);
  assert.deepEqual(value.response.body, { unavailable: 'response-body-timeout' });
  assert.equal(value.endpoint, 'https://stg2.shop.samsung.com/pe/cart');
});

test('evidence cannot block the business action and response collection is capped', async () => {
  let handler, reads = 0, attachment;
  const page = { on: (_, callback) => { handler = callback; }, off: (_, callback) => assert.equal(callback, handler),
    waitForTimeout: async () => {} };
  const info = { attach: async (_, value) => { attachment = JSON.parse(value.body.toString()); } };
  const result = await captureBusinessExchange(page, info, 'Cart', async () => {
    for (let i = 0; i < 10; i++) handler(response(() => { reads++; return new Promise(() => {}); }));
    return 'checkout-ready';
  }, { max: 2, bodyTimeoutMs: 5 });
  assert.equal(result, 'checkout-ready');
  assert.equal(reads, 2);
  assert.equal(attachment.length, 2);
});

test('normal response bodies remain available and an action failure is never hidden', async () => {
  const value = await serializeExchange(response(async () => '{"quantity":1}'), { bodyTimeoutMs: 50 });
  assert.equal(value.response.body.quantity, 1);
  const page = { on: () => {}, off: () => {}, waitForTimeout: async () => {} };
  await assert.rejects(captureBusinessExchange(page, null, 'Cart', async () => { throw Error('real failure'); }), /real failure/);
});
