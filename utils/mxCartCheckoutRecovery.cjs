// MX #24 returned the cart document headers after 105.7s while its native
// recovery aborted at 60s. Bound this already-existing GET, not another click
// or another reload. Other markets/environments keep their existing budget.
async function reloadMxCartForCheckout(page, cartUrl) {
  const target = new URL(cartUrl);
  const current = new URL(page.url());
  if (target.protocol !== 'https:' || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(target.hostname) ||
      target.pathname !== '/mx/cart' || current.origin !== target.origin || current.pathname !== target.pathname) {
    throw new Error('MX_CART_RECOVERY_SCOPE: recovery requires the same MX staging Base Store cart.');
  }
  return page.reload({ waitUntil: 'domcontentloaded', timeout: target.hostname === 'stg2.shop.samsung.com' ? 120000 : 60000 });
}
module.exports = { reloadMxCartForCheckout };
