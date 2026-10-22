async function readMxCartSku(page, { cartUrl, sku, timeout = 15000 }) {
  const target = new URL(cartUrl);
  if (target.protocol !== 'https:' || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(target.hostname) || target.pathname !== '/mx/cart') {
    throw new Error('MX cart readback requires the configured staging cart.');
  }
  const product = page.getByText(sku, { exact: true }).filter({ visible: true }).first();
  const sameCart = () => {
    const current = new URL(page.url());
    return current.origin === target.origin && current.pathname === target.pathname;
  };
  if (sameCart() && await product.isVisible()) return true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = new URL(target);
    if (attempt) url.searchParams.set('_qa_cart_readback', String(Date.now()));
    try {
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response && !response.ok()) throw new Error(`MX cart readback returned HTTP ${response.status()}.`);
    } catch (error) {
      if (attempt || !/ERR_ABORTED|Timeout.*exceeded/i.test(error.message)) throw error;
      // A competing native cart navigation may have completed. Never re-add
      // because a document navigation was interrupted.
      if (sameCart() && await product.isVisible()) return true;
      continue;
    }
    if (await product.waitFor({ state: 'visible', timeout }).then(() => true, () => false)) return true;
    const empty = page.getByRole('main').getByText(/(?:Su|Tu) carrito est[aá] vac[ií]o/i).filter({ visible: true }).first();
    if (await empty.isVisible()) return false;
    throw new Error('MX cart readback is unresolved; product absence was not proven and Add will not be repeated.');
  }
  throw new Error('MX cart document did not become readable; Add will not be repeated.');
}
module.exports = { readMxCartSku };
