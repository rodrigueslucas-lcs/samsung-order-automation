const { test } = require('node:test');
const assert = require('node:assert/strict');
const { waitForPeBankDetails } = require('../../utils/peBankPaymentReadiness.cjs');

const path = '/tokocommercewebservices/v2/pe/users/current/carts/current/paymentmodes/pe-Bancapor/details';
function response(url = 'https://s2-smb-api-cdn.ecom-stg.samsung.com' + path, extra = {}) {
  return { url: () => url, request: () => ({ method: () => 'GET' }), ok: () => true,
    status: () => 200, finished: async () => null, ...extra };
}

test('Internet Banking waits for its exact staging details response and complete body', async () => {
  let finish, ready = false;
  const pending = waitForPeBankDetails({ waitForResponse: async predicate => {
    assert.equal(predicate(response()), true);
    for (const url of ['https://foreign.example' + path,
      'https://s2-smb-api-cdn.ecom-stg.samsung.com' + path.replace('pe-Bancapor', 'pe-mercadoCC'),
      'https://s2-smb-api-cdn.ecom-stg.samsung.com' + path.replace('/pe/', '/co/')]) assert.equal(predicate(response(url)), false);
    return response(undefined, { finished: () => new Promise(resolve => { finish = resolve; }) });
  } }).then(() => { ready = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, false);
  finish(null);
  await pending;
  assert.equal(ready, true);
});

test('failed, interrupted and hanging bank details do not authorize payment', async () => {
  for (const extra of [{ ok: () => false, status: () => 400 },
    { finished: async () => Error('interrupted') }, { finished: () => new Promise(() => {}) }]) {
    await assert.rejects(waitForPeBankDetails({ waitForResponse: async () => response(undefined, extra) },
      { bodyTimeout: 5 }), /no payment was submitted/);
  }
});
