import { test, expect } from "@playwright/test";
import eppConfigModule from "../../../../../config/markets/epp";
import { addConfiguredEppProduct, openEppStore, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("CL");

function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "CL EPP access is configured from the official data; CL_EPP_QST_PDP_URL and CL_EPP_QST_SKU are still required for product/cart execution because no CL EPP SKU was supplied.");
}

test.describe("CL QST - EPP Official P1", () => {
  test.setTimeout(420000);

  test("SAM-24836 @qst @cl @epp @safe - Epp Login", async ({ page }) => {
    await test.step("Open the official CL EPP storefront and complete the supplied JET85 verification gate when present", async () => {
      const current = cfg();
      await openEppStore(page, current);
      await expect(page).toHaveURL((url) => url.hostname === current.rootUrl.hostname);
      await expect(page.locator("body")).toContainText(/Samsung|Tienda|Shop|Producto|Alianza/i, { timeout: 60000 });
    });
  });

  test("SAM-24840 @qst @cl @epp @safe - Able to add to Cart from PDP", async ({ page }) => {
    await test.step("Add the configured CL EPP product from PDP", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-24841 @qst @cl @epp @safe - Cart page UI", async ({ page }) => {
    await test.step("Validate CL EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-24851 @qst @cl @epp @safe - Checkout button on cart page", async ({ page }) => {
    await test.step("Validate CL EPP cart checkout navigation", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.validateCheckoutButton();
      await cart.proceedToCheckout();
      await expect(page).toHaveURL(/checkout|guestlogin|login|account/i, { timeout: 60000 });
    });
  });

  test("SAM-24864 @blocked @destructive @qst @cl @epp @registered - Payment using credit / Debit card with reg user", async () => {
    await test.step("Represent the official CL EPP card-payment case without unauthorized order placement", async () => {
      test.skip(true, "CL EPP card payment requires a supplied EPP PDP/SKU, authenticated checkout and explicit ALLOW_PAYMENT_SUBMIT authorization before order placement is enabled.");
    });
  });

  test("SAM-24865 @blocked @destructive @qst @cl @epp - Payment using Direct Bank Transfer", async () => {
    await test.step("Represent the official CL EPP Direct Bank Transfer case and its CS dependency", async () => {
      test.skip(true, "CL EPP Direct Bank Transfer requires the EPP checkout path plus CS/BackOffice approval or rejection handling; it is not safe to fabricate this dependency.");
    });
  });

  test("SAM-24866 @blocked @destructive @qst @cl @epp - Order confirmation screen", async () => {
    await test.step("Represent the official CL EPP order-confirmation case without fabricating an order", async () => {
      test.skip(true, "CL EPP order confirmation requires a successfully authorized EPP order from a payment scenario; no order is created implicitly for evidence.");
    });
  });
});
