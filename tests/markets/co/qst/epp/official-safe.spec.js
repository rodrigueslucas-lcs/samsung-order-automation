import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import {runEppPaymentPrerequisiteCase} from '../../../../../flows/eppPaymentPrerequisites';
import { addConfiguredEppProduct, validateEppLogin, validateEppVariants, validateEppCheckout, validateEppContact, openEppStore, validateBackToTop, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("CO");


function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "CO EPP product/cart scenarios require CO_EPP_QST_PDP_URL and CO_EPP_QST_SKU when the supplied environment URL is not already a PDP.");
}

test.describe("CO QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-24929 @qst @co @epp @safe - Variants/selectors on PDP", async ({ page }, testInfo) => {
    await test.step("Choose a PDP variant and prove selected option and changed product identity", async () => {
      const current = cfg();
      await validateEppVariants(page, current);
    });
  });

  test("SAM-24930 @qst @co @epp @safe - Able to add to Cart from PDP", async ({ page }, testInfo) => {
    await test.step("Add the configured CO EPP product from PDP", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
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

  test("SAM-24953 @preflight @destructive @qst @co @epp @registered - Payment using credit card with reg user", async ({page}, testInfo) => {
    await test.step("Inspect authenticated EPP cart, checkout and payment prerequisites", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'card'});
    });
  });
});
