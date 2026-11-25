const { expect } = require('@playwright/test');

// Additional detailed-export requirements for DST only. QST keeps its own contract.
async function validateDstBcAttributes(page, sku) {
  const device = page.locator(`input[name="device-rdo"][data-modelcode="${sku}"]:checked`);
  await expect(device).toBeAttached();
  const expectedPrice = Number(await device.getAttribute('data-modelprice'));
  expect(Number.isFinite(expectedPrice) && expectedPrice > 0, 'Native selected device price').toBe(true);
  const price = page.locator('.device-price-info').filter({ visible: true }).first();
  await expect(price, 'Rendered BC/PDP device price').toBeVisible();
  const displayedPrice = Number((await price.innerText()).replace(/[^\d.]/g, ''));
  expect(displayedPrice, 'Rendered price matches selected native device').toBe(expectedPrice);
  const color = page.locator(`input[name="basic-color"][data-modelcode="${sku}"]:checked`);
  if (!(await color.count())) {
    throw new Error('DST_BC_COLOUR_NOT_RENDERED: selected native SKU has price/device/storage but no selected colour control; detailed export colour step is unproven. No Add request submitted.');
  }
  const colorText = (await color.getAttribute('aria-label')) || (await color.getAttribute('title')) ||
    (await color.evaluate(input => [...(input.labels || [])].map(label => label.innerText).join(' ')));
  if (!colorText.trim()) throw new Error('DST_BC_COLOUR_LABEL_REQUIRED: native colour selection has no readable label. No Add request submitted.');
  return { displayedPrice, colorText: colorText.trim(), sku };
}

module.exports = { validateDstBcAttributes };
