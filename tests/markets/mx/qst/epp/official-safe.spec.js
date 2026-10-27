import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import { addConfiguredEppProduct, validateEppLogin, validateEppFilter, validateEppCheckout, validateEppContact, openEppStore, validateBackToTop, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("MX");

function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "MX EPP product/cart scenarios require MX_EPP_QST_PDP_URL and MX_EPP_QST_SKU when the supplied environment URL is not already a PDP.");
}

test.describe("MX QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25020 @qst @mx @epp @safe - Facets/Filter on PLP", async ({ page }) => {
    await test.step("Open the official MX EPP storefront and validate PLP filtering entry point", async () => {
      const current = cfg();
      await validateEppFilter(page, current);
    });
  });

  test("SAM-25021 @qst @mx @epp @safe - Able to add to Cart from PDP", async ({ page }) => {
    await test.step("Add the configured official MX EPP product from PDP to cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { fromPlp: true, currencyPattern: /\$\s*[\d.,]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-25022 @qst @mx @epp @safe - Cart page UI", async ({ page }) => {
    await test.step("Validate official MX EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-25034 @qst @mx @epp @safe - Step 1: Contact information", async ({ page }) => {
    await test.step("Reach MX EPP checkout and validate the contact-information section", async () => {
      const current = cfg();
      requireProductConfig(current);
      const customer = require('../../../../../utils/eppRuntimeData.cjs').getEppContact(current);
      test.skip(!customer, 'BLOCKED: EPP contact QA data is missing.');
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.proceedToAuthenticatedCheckout();
      await validateEppContact(page, current, customer);
    });
  });

  test("SAM-25044 @qst @mx @epp @safe - Verify Back to Top", async ({ page }) => {
    await test.step("Validate Back to Top on the official MX EPP cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateBackToTop(page);
    });
  });

  test("SAM-25045 @blocked @destructive @qst @mx @epp @registered - Payment using credit card with reg user", async () => {
    await test.step("Keep the official MX EPP card-payment case represented without submitting an unapproved order", async () => {
      test.skip(true, "BLOCKED_NOT_IMPLEMENTED: EPP registered checkout and card provider contract are not runtime-proven; no payment is submitted.");
    });
  });

  test("SAM-25046 @blocked @destructive @qst @mx @epp - Pay in Cash", async () => {
    await test.step("Keep the official MX EPP cash-payment case represented without placing an order", async () => {
      test.skip(true, "BLOCKED_NOT_IMPLEMENTED: EPP cash provider, controlled order total and provider limit are not runtime-proven; no order is submitted.");
    });
  });
});
