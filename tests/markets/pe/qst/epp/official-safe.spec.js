import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import { addConfiguredEppProduct, validateEppLogin, validateEppFilter, validateEppCheckout, validateEppContact, openEppStore, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("PE");


function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "PE EPP access is configured from the official data; PE_EPP_QST_PDP_URL and PE_EPP_QST_SKU are still required for product/cart execution because no EPP SKU was supplied.");
}

test.describe("PE QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25109 @qst @pe @epp @safe - EPP Login", async ({ page }, testInfo) => {
    await test.step("Open the official PE EPP storefront and complete the supplied verification-code gate when present", async () => {
      const current = cfg();
      await validateEppLogin(page, current);
    });
  });

  test("SAM-25113 @qst @pe @epp @safe - Able to add to Cart from PDP", async ({ page }, testInfo) => {
    await test.step("Add the configured PE EPP product from PDP", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /S\/\s*[\d,.]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-25114 @qst @pe @epp @safe - Cart page UI", async ({ page }, testInfo) => {
    await test.step("Validate PE EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /S\/\s*[\d,.]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-25125 @qst @pe @epp @safe - Checkout button on cart page", async ({ page }, testInfo) => {
    await test.step("Validate PE EPP cart checkout navigation", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /S\/\s*[\d,.]+/ });
      await cart.validateCheckoutButton();
      await cart.proceedToCheckout();
      await validateEppCheckout(page, current);
    });
  });

  test("SAM-25138 @blocked @destructive @qst @pe @epp @registered - Payment using credit card with reg user", async ({}, testInfo) => {
    await test.step("Represent the official PE EPP card-payment case without unauthorized order placement", async () => {
      test.skip(true, "BLOCKED_NOT_IMPLEMENTED: accepted EPP code, eligible SKU, registered checkout and card provider contract are not proven.");
    });
  });

  test("SAM-25140 @blocked @destructive @qst @pe @epp - Order confirmation screen", async ({}, testInfo) => {
    await test.step("Represent the official PE EPP confirmation case without fabricating an order", async () => {
      test.skip(true, "BLOCKED_NOT_IMPLEMENTED: this case requires its own newly created and confirmed EPP order; no compatible payment flow is proven.");
    });
  });
});
