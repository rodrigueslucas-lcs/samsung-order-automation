import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import {runEppPaymentPrerequisiteCase} from '../../../../../flows/eppPaymentPrerequisites';
import { addConfiguredEppProduct, validateEppLogin, validateEppVariants, validateEppCheckout, validateEppContact, openEppStore, validateBackToTop, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("MX");

function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "MX EPP product/cart scenarios require MX_EPP_QST_PDP_URL and MX_EPP_QST_SKU when the supplied environment URL is not already a PDP.");
}

test.describe("MX QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25020 @qst @mx @epp @safe - Variants/selectors on PDP", async ({ page }) => {
    await test.step("Choose a PDP variant and prove selected option and changed product identity", async () => {
      const current = cfg();
      await validateEppVariants(page, current);
    });
  });

  test("SAM-25021 @qst @mx @epp @safe - Able to add to Cart from PDP", async ({ page }) => {
    await test.step("Add the configured official MX EPP product from PDP to cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/, resetMxCart: true });
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

  test("SAM-25045 @destructive @qst @mx @epp @registered - Payment using credit card with reg user", async ({page}) => {
    await test.step("Create one causal MX EPP card order and validate its confirmation", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'card'});
    });
  });

  test("SAM-25046 @preflight @destructive @qst @mx @epp - Pay in Cash", async ({page}) => {
    await test.step("Inspect authenticated EPP cart, checkout and payment prerequisites", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'cash'});
    });
  });
});
