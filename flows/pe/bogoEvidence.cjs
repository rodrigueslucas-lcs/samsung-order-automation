function validatePeBogoCart(cart, sourceSku, expectedGiftSkus = null) {
  const entries = cart.entries || [];
  const paid = entries.filter(entry => Number(entry.totalPrice?.value) > 0);
  const gifts = entries.filter(entry => entry.giveAway === true);
  const source = paid[0];
  if (paid.length !== 1 || source?.product?.code !== sourceSku || !Number.isInteger(source.quantity) || source.quantity < 1 ||
      source.giveAway === true || !gifts.length || entries.length !== paid.length + gifts.length ||
      (expectedGiftSkus && (gifts.length !== expectedGiftSkus.length ||
        expectedGiftSkus.some(sku => gifts.filter(entry => entry.product?.code === sku).length !== 1))) ||
      gifts.some(entry => !entry.product?.code || entry.quantity !== source.quantity ||
        entry.basePrice?.value !== 0 || entry.totalPrice?.value !== 0) ||
      cart.totalPrice?.currencyIso !== 'PEN' || !Number.isFinite(cart.totalPrice?.value) ||
      cart.totalPrice.value !== source.totalPrice.value) {
    throw new Error('PE BOGO was not proven: require one paid source SKU, matching promotional gift quantities, zero-priced gifts and an unchanged PEN total.');
  }
  return {
    sourceSku, sourceQuantity: source.quantity, sourceTotal: source.totalPrice.value,
    gifts: gifts.map(entry => ({ sku: entry.product.code, quantity: entry.quantity, total: 0 })),
    cartTotal: cart.totalPrice.value, currency: 'PEN',
  };
}

module.exports = { validatePeBogoCart };
