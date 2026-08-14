import { test } from "@playwright/test";
import ProductPage from "../../../pages/ProductPage";

test.describe("ST2 - PDP", () => {
  test("Should open PDP from cart and validate product page", async ({ page }) => {
    test.setTimeout(120000);
    const productPage = new ProductPage(page);

    const pdpPage = await productPage.openPdpFromCart();

    await productPage.validatePdp(pdpPage);
  });


  test("Should display product attributes on PDP", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);

    const pdpPage = await productPage.openPdpFromCart();

    await productPage.validateProductAttributes(pdpPage);
  });
});
