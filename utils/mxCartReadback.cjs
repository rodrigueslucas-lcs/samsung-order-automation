async function readMxCartSku(page, { cartUrl, sku, timeout = 20000 }) {
  const target = new URL(cartUrl);
  if (target.protocol !== 'https:' || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(target.hostname) || target.pathname !== '/mx/cart') {
    throw new Error('MX cart readback requires the configured staging cart.');
  }

  const main = page.getByRole('main');
  const product = page.getByText(sku, { exact: true }).filter({ visible: true }).first();
  const empty = main.getByText(/(?:Su|Tu) carrito est[aá] vac[ií]o|carrito.*vac[ií]o/i).filter({ visible: true }).first();
  const sameCart = () => {
    const current = new URL(page.url());
    return current.origin === target.origin && current.pathname === target.pathname;
  };

  const readStableState = async (stateTimeout = timeout) => {
    const deadline = Date.now() + stateTimeout;
    while (Date.now() < deadline) {
      if (await product.isVisible().catch(() => false)) return 'present';
      if (await empty.isVisible().catch(() => false)) return 'empty';

      const loading = await page
        .locator('[aria-busy="true"], [class*="skeleton" i], [class*="loading" i], [class*="spinner" i]')
        .filter({ visible: true })
        .count()
        .catch(() => 0);
      if (!loading) {
        // Give the cart one short settlement window after loaders disappear.
        await page.waitForTimeout(500);
        if (await product.isVisible().catch(() => false)) return 'present';
        if (await empty.isVisible().catch(() => false)) return 'empty';
      }
      await page.waitForTimeout(500);
    }
    return 'unresolved';
  };

  if (sameCart()) {
    const currentState = await readStableState(Math.min(timeout, 5000));
    if (currentState === 'present') return true;
    if (currentState === 'empty') return false;
  }

  // Never repeat Add unless product absence is proven. When cart rendering is
  // indeterminate, perform bounded document recovery and read again first.
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = new URL(target);
    url.searchParams.set('_qa_cart_readback', `${Date.now()}-${attempt}`);

    try {
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (response && !response.ok()) throw new Error(`MX cart readback returned HTTP ${response.status()}.`);
    } catch (error) {
      if (!/ERR_ABORTED|Timeout.*exceeded/i.test(String(error?.message || ''))) throw error;
      // Native navigation can supersede goto. Read the state that actually won.
      if (!sameCart()) {
        if (attempt < 2) continue;
        throw new Error('MX cart document did not become readable; Add will not be repeated.');
      }
    }

    if (!sameCart()) throw new Error('MX cart readback left the configured staging cart.');
    await main.waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
    // The Add caller's short SKU probe is not enough for a cold commerce load.
    // Keep the remote bounded recovery and require a definitive rendered state.
    const state = await readStableState(Math.max(timeout, 30000));
    if (state === 'present') return true;
    if (state === 'empty') return false;

    if (attempt < 2) {
      await page.waitForTimeout(1000);
      continue;
    }
  }

  const diagnostic = await main.innerText({ timeout: 5000 }).catch(() => '');
  throw new Error(
    `MX cart readback remained unresolved after bounded recovery; product absence was not proven and Add will not be repeated. ` +
    `url=${page.url()} main=${String(diagnostic || '').replace(/\s+/g, ' ').trim().slice(0, 400) || '<empty>'}`
  );
}

module.exports = { readMxCartSku };
