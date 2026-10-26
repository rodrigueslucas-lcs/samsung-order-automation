async function waitForMxBcProductCard(page, sku, { timeout = 30000 } = {}) {
  if (!/^[A-Z0-9-]+$/.test(sku)) throw new Error('Invalid MX BC model.');
  const card = page.locator("[role='listitem'].pd21-product-card__item")
    .filter({ has: page.locator(`a.pd21-product-card__name[data-modelcode='${sku}']`) }).first();
  try {
    await card.waitFor({ state: 'visible', timeout });
    return card;
  } catch (original) {
    const url = new URL(page.url());
    const approved = url.origin === 'https://p6-pre-qa2.samsung.com' &&
      /^\/mx\/smartphones\/all-smartphones\/?$/.test(url.pathname);
    if (!approved) throw original;
    const loadedModels = await page.locator('a.pd21-product-card__name[data-modelcode]').count();
    // Recover only an empty catalog before any product/cart mutation. A loaded
    // catalog missing the requested SKU is data evidence, not a reason to retry.
    if (loadedModels) throw new Error(`MX BC loaded ${loadedModels} product links without the configured model ${sku}.`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await card.waitFor({ state: 'visible', timeout });
    return card;
  }
}
module.exports = { waitForMxBcProductCard };
