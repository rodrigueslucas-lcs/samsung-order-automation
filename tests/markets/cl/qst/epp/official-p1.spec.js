import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import {runEppPaymentPrerequisiteCase} from '../../../../../flows/eppPaymentPrerequisites';
import { addConfiguredEppProduct, validateEppLogin, validateEppCheckout, validateEppContact, openEppStore, validateEppCartUi } from "../../../../../flows/eppStorefront";

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
      await validateEppLogin(page, current);
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
      await cart.proceedToAuthenticatedCheckout();
      await validateEppCheckout(page, current);
    });
  });

  test("SAM-24864 @preflight @destructive @qst @cl @epp @registered - Payment using credit / Debit card with reg user", async ({page}) => {
    await test.step("Inspect authenticated EPP cart, checkout and payment prerequisites", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'card'});
    });
  });

  test("SAM-24865 @preflight @destructive @qst @cl @epp - Payment using Direct Bank Transfer", async ({page}) => {
    await test.step("Inspect authenticated EPP cart, checkout and payment prerequisites", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'transfer'});
    });
  });

  test("SAM-24866 @preflight @destructive @qst @cl @epp - Order confirmation screen", async ({page}) => {
    await test.step("Inspect authenticated EPP cart, checkout and payment prerequisites", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'card',confirmationOnly:true});
    });
  });
});
