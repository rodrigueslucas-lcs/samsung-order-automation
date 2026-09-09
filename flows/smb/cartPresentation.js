const { expect } = require("@playwright/test");

async function findCartItemBySku(page, sku) {
  const main = page.getByRole("main");
  const skuLabel = main.getByText(sku, { exact: true }).filter({ visible: true });
  await expect(skuLabel.first()).toBeVisible({ timeout: 30000 });

  return skuLabel.first().locator(
    "xpath=ancestor::*[.//input[@aria-label='Quantity'] or .//button[contains(@aria-label,'Remove') or contains(@aria-label,'Eliminar')]][1]"
  );
}

async function validateCartItemPresentation(page, { sku, currencyPattern }) {
  if (!sku) throw new Error("Cart presentation requires a configured SKU.");
  if (!(currencyPattern instanceof RegExp)) {
    throw new TypeError("Cart presentation requires a currencyPattern RegExp.");
  }

  const item = await findCartItemBySku(page, sku);
  await expect(item).toBeVisible({ timeout: 30000 });

  const price = item.getByText(currencyPattern).filter({ visible: true }).first();
  await expect(price).toBeVisible({ timeout: 30000 });

  const images = item.locator("img:visible");
  expect(await images.count()).toBeGreaterThan(0);
  const image = images.first();
  await expect(image).toBeVisible({ timeout: 30000 });
  expect(
    (await image.getAttribute("src")) || (await image.getAttribute("data-src"))
  ).toBeTruthy();

  return { priceVisible: true, thumbnailVisible: true };
}

async function inspectAvailableServices(page) {
  const main = page.getByRole("main");
  const explicitServiceControls = main.locator(
    'button[data-an-la*="service" i]:visible, button:visible'
  ).filter({ hasText: /Samsung Care\+|Servicios Adicionales|Servicio adicional|Garant[ií]a|Canje|Trade/i });

  const serviceText = main
    .getByText(/Samsung Care\+|Servicios Adicionales|Servicio adicional|Garant[ií]a|Canje|Trade/i)
    .filter({ visible: true });

  return {
    visible: (await explicitServiceControls.count()) > 0 || (await serviceText.count()) > 0,
    controlCount: await explicitServiceControls.count(),
    textCount: await serviceText.count(),
  };
}

module.exports = { findCartItemBySku, inspectAvailableServices, validateCartItemPresentation };
