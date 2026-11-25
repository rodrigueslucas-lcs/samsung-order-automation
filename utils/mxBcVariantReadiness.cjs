async function selectMxBcVariant(page, sku, { timeout = 30000 } = {}) {
  const url = new URL(page.url());
  if (url.origin !== 'https://p6-pre-qa2.samsung.com' || url.pathname !== '/mx/smartphones/galaxy-z-fold6/buy/' || !/^SM-[A-Z0-9]+$/.test(sku)) {
    throw new Error('MX_BC_VARIANT_SCOPE_INVALID: expected the authorized MX PreQA buying tool.');
  }
  const selectedDefault = async () =>
    await page.locator(`input[name="device-rdo"][data-modelcode="${sku}"]:checked`).count() === 1 &&
    await page.locator(`input[name^="memory-rdo"][data-modelcode="${sku}"]:checked`).count() === 1 &&
    await page.locator(`a[an-ac="addToCart"][data-modelcode="${sku}"]`).filter({visible:true}).count() > 0;
  // The catalog can link to an already selected online-exclusive variant.
  // In that case no color choice is necessary: the native checked device,
  // storage and actual cart CTA must independently agree on the intended SKU.
  if (await selectedDefault()) return {selection:'EXISTING_NATIVE_DEFAULT'};
  const color = page.locator(`input[name="basic-color"][data-modelcode="${sku}"]`);
  const ready = () => color.waitFor({ state: 'attached', timeout }).then(() => true, () => false);
  let attached = await ready();
  if (!attached && await selectedDefault()) return {selection:'EXISTING_NATIVE_DEFAULT'};
  if (!attached && await page.locator('input[name="basic-color"]').count() === 0) {
    // A missing native module can be recovered with one document GET before
    // any Trade-in, Care+ or Add action. Never substitute the default model.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    attached = await ready();
    if (!attached && await selectedDefault()) return {selection:'EXISTING_NATIVE_DEFAULT'};
  }
  if (!attached) throw new Error('MX_BC_VARIANT_CONTROL_UNAVAILABLE: configured SKU has no native color control; no substitute SKU or Add request.');
  await color.locator('xpath=..').locator('label').click();
  const { expect } = require('@playwright/test');
  await expect(color).toBeChecked();
  return {selection:'NATIVE_COLOR_CONTROL'};
}
module.exports = { selectMxBcVariant };
