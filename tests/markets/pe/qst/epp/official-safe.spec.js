import { test, expect } from "../../../../../utils/eppTestFixtures";
import eppConfigModule from "../../../../../config/markets/epp";
import {runEppPaymentPrerequisiteCase} from '../../../../../flows/eppPaymentPrerequisites';
import { addConfiguredEppProduct, validateEppLogin, validateEppCheckout, validateEppContact, openEppStore, validateEppCartUi } from "../../../../../flows/eppStorefront";

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
      await cart.proceedToAuthenticatedCheckout();
      await validateEppCheckout(page, current);
    });
  });

  test("SAM-25138 @destructive @qst @pe @epp @registered - Payment using credit card with reg user", async ({page}, testInfo) => {
    await test.step("Complete PE EPP card checkout or reconcile the existing causal order", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'card'});
    });
  });

  test("SAM-25140 @destructive @qst @pe @epp - Order confirmation screen", async ({page}, testInfo) => {
    await test.step("Validate the causal PE EPP order confirmation without duplicate submit", async () => {
      await runEppPaymentPrerequisiteCase(page,cfg(),{kind:'card',confirmationOnly:true});
    });
  });
});
