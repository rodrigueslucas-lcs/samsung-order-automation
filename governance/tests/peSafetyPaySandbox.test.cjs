const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readSafetyPayAttempt, assertSandboxOrder } = require('../../flows/pe/safetyPaySandbox.cjs');

test('SafetyPay uses the current displayed payment code and full PEN amount', () => {
  assert.deepEqual(readSafetyPayAttempt('Código de pago\n226864\nTOTAL\nS/ 5,499.00'), {
    paymentCode: '226864', amount: '5499.00',
  });
});

test('SafetyPay refuses expired, missing, zero and foreign-currency attempts', () => {
  for (const text of ['Código de pago 1 TOTAL S/ 0.00', 'Código de pago 1 TOTAL USD 5499.00',
    'TOTAL S/ 5499.00', 'Código de pago 1 TOTAL S/ 5499.00 tiempo ha expirado']) {
    assert.throws(() => readSafetyPayAttempt(text), /Do not create another order/);
  }
});

test('SafetyPay completion is restricted to sandbox, staging and the existing PE order', () => {
  const valid = { gatewayUrl: 'https://sandbox-gateway.safetypay.com/Express4/Checkout/index',
    storefrontOrigin: 'https://stg2.shop.samsung.com', orderCode: 'PE261019-78739048_261020022748337' };
  assert.doesNotThrow(() => assertSandboxOrder(valid));
  for (const override of [{ gatewayUrl: 'https://gateway.safetypay.com/' },
    { storefrontOrigin: 'https://www.samsung.com' }, { orderCode: 'MX261019-78739048' }]) {
    assert.throws(() => assertSandboxOrder({ ...valid, ...override }), /genuine sandbox/);
  }
});
