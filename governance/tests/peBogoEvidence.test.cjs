const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePeBogoCart } = require('../../flows/pe/bogoEvidence.cjs');

function cart() {
  return { totalPrice: { value: 3500, currencyIso: 'PEN' }, entries: [
    { product: { code: 'S25' }, quantity: 1, totalPrice: { value: 3500 } },
    ...['BUDS', 'S25'].map(code => ({ product: { code }, quantity: 1,
      giveAway: true, basePrice: { value: 0 }, totalPrice: { value: 0 } })),
  ] };
}

test('PE proves BOGO without a label, including a free duplicate of the paid SKU', () => {
  const proof = validatePeBogoCart(cart(), 'S25');
  assert.equal(proof.gifts.length, 2);
  assert.equal(proof.cartTotal, proof.sourceTotal);
});

test('PE proves the same BOGO proportion for multiple paid units without charging the gifts', () => {
  const value = cart();
  for (const entry of value.entries) entry.quantity = 2;
  value.entries[0].totalPrice.value = 7000;
  value.totalPrice.value = 7000;
  assert.equal(validatePeBogoCart(value, 'S25').sourceQuantity, 2);
});

test('PE verifies both configured gift SKUs, rejecting a missing or substituted free gift', () => {
  assert.equal(validatePeBogoCart(cart(), 'S25', ['S25', 'BUDS']).gifts.length, 2);
  const missing = cart(); missing.entries.pop();
  assert.throws(() => validatePeBogoCart(missing, 'S25', ['S25', 'BUDS']), /not proven/);
  const wrong = cart(); wrong.entries[1].product.code = 'OTHER';
  assert.throws(() => validatePeBogoCart(wrong, 'S25', ['S25', 'BUDS']), /not proven/);
});

test('PE rejects labels without real promotional gifts and ordinary zero-price entries', () => {
  const value = cart();
  value.entries = [value.entries[0]];
  value.promotionLabel = 'BOGO Gift';
  assert.throws(() => validatePeBogoCart(value, 'S25'), /not proven/);
  const ordinary = cart(); ordinary.entries[1].giveAway = false;
  assert.throws(() => validatePeBogoCart(ordinary, 'S25'), /not proven/);
});

test('PE rejects wrong source, charged gifts, quantity drift and total/currency mismatch', () => {
  for (const change of [c => c.entries[0].product.code = 'WRONG',
    c => c.entries[0].quantity = 2, c => c.entries[1].quantity = 2,
    c => c.entries[1].totalPrice.value = 1, c => c.entries[1].basePrice.value = 1,
    c => c.totalPrice.value = 3501, c => c.totalPrice.currencyIso = 'COP']) {
    const value = cart(); change(value);
    assert.throws(() => validatePeBogoCart(value, 'S25'), /not proven/);
  }
});
