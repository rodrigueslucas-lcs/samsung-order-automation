import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import { addConfiguredEppProduct, validateEppLogin, validateEppFilter, validateEppCheckout, validateEppContact, openEppStore, validateBackToTop, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("CO");


function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "CO EPP product/cart scenarios require CO_EPP_QST_PDP_URL and CO_EPP_QST_SKU when the supplied environment URL is not already a PDP.");
}

test.describe("CO QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-24929 @qst @co @epp @safe - Facets/Filter on PLP", async ({ page }, testInfo) => {
    await test.step("Open the official CO EPP PLP and validate a filter entry point", async () => {
      const current = cfg();
      await validateEppFilter(page, current);
    });
  });

  test("SAM-24930 @qst @co @epp @safe - Able to add to Cart from PDP", async ({ page }, testInfo) => {
    await test.step("Add the configured CO EPP product from PDP", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { fromPlp: true, currencyPattern: /\$\s*[\d.,]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-24931 @qst @co @epp @safe - Cart page UI", async ({ page }, testInfo) => {
    await test.step("Validate CO EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-24942 @qst @co @epp @safe - Step 1: Contact Details Section", async ({ page }, testInfo) => {
    await test.step("Reach CO EPP checkout and validate contact details", async () => {
      const current = cfg();
      requireProductConfig(current);
      const customer = require('../../../../../utils/eppRuntimeData.cjs').getEppContact(current);
      test.skip(!customer, 'BLOCKED: EPP contact QA data is missing.');
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.proceedToAuthenticatedCheckout();
      await validateEppContact(page, current, customer);
    });
  });

  test("SAM-24952 @qst @co @epp @safe - Verify Back to Top", async ({ page }, testInfo) => {
    await test.step("Validate Back to Top on the official CO EPP cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateBackToTop(page);
    });
  });

  test("SAM-24953 @blocked @destructive @qst @co @epp @registered - Payment using credit card with reg user", async ({}, testInfo) => {
    await test.step("Keep the official CO EPP card-payment case represented without unauthorized order placement", async () => {
      test.skip(true, "BLOCKED_NOT_IMPLEMENTED: EPP activation/registered checkout and card provider contract are not runtime-proven; no payment is submitted.");
    });
  });
});
