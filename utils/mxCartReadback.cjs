async function readMxCartSku(page, options) {
  return require('./productCartReadback.cjs').readProductCartSku(page, { ...options, market: 'MX' });
}
module.exports = { readMxCartSku };
