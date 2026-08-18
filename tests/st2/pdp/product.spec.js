import { test } from "@playwright/test";

import ProductPage from "../../../pages/ProductPage";

test.describe("ST2 - PDP", () => {

  test("PDP - Customer able to navigate to and validate Product Detail Page", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);

    const pdpPage = await productPage.openPdpFromCart();

    await productPage.validatePdp(pdpPage);
  });

  test("PDP - Customer able to verify product attributes", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);

    const pdpPage = await productPage.openPdpFromCart();

    await productPage.validateProductAttributes(pdpPage);
  });

  test("PDP - Customer able to verify selected product color variant", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);

    const pdpPage = await productPage.openPdpFromCart();

    await productPage.validateSelectedColorVariant(pdpPage);
  });

});
