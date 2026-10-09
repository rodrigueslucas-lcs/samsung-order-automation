import { test, expect } from "@playwright/test";
import eppConfigModule from "../../../../../config/markets/epp";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { addConfiguredEppProduct, openEppStore, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;
const cfg = () => getEppConfig("PE");

function evidence(testInfo, id) {
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(id));
}

function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "PE EPP access is configured from the official data; PE_EPP_QST_PDP_URL and PE_EPP_QST_SKU are still required for product/cart execution because no EPP SKU was supplied.");
}

test.describe("PE QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25109 @qst @pe @epp @safe - EPP Login", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25109");
    await test.step("Open the official PE EPP storefront and complete the supplied verification-code gate when present", async () => {
      const current = cfg();
      await openEppStore(page, current);
      await expect(page).toHaveURL((url) => url.hostname === current.rootUrl.hostname);
      await expect(page.locator("body")).toContainText(/Samsung|Tienda|Shop|Producto|Beneficio/i, { timeout: 60000 });
    });
  });

  test("SAM-25113 @qst @pe @epp @safe - Able to add to Cart from PDP", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25113");
    await test.step("Add the configured PE EPP product from PDP", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /S\/\s*[\d,.]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-25114 @qst @pe @epp @safe - Cart page UI", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25114");
    await test.step("Validate PE EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /S\/\s*[\d,.]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-25125 @qst @pe @epp @safe - Checkout button on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25125");
    await test.step("Validate PE EPP cart checkout navigation", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /S\/\s*[\d,.]+/ });
      await cart.validateCheckoutButton();
      await cart.proceedToCheckout();
      await expect(page).toHaveURL(/checkout|login|account/i, { timeout: 60000 });
    });
  });

  test("SAM-25138 @blocked @destructive @qst @pe @epp @registered - Payment using credit card with reg user", async ({}, testInfo) => {
    evidence(testInfo, "SAM-25138");
    await test.step("Represent the official PE EPP card-payment case without unauthorized order placement", async () => {
      test.skip(true, "PE EPP card payment is mapped from the official TC but remains guarded until an EPP PDP/SKU and authenticated checkout are runtime-proven with explicit ALLOW_PAYMENT_SUBMIT authorization.");
    });
  });

  test("SAM-25140 @blocked @destructive @qst @pe @epp - Order confirmation screen", async ({}, testInfo) => {
    evidence(testInfo, "SAM-25140");
    await test.step("Represent the official PE EPP confirmation case without fabricating an order", async () => {
      test.skip(true, "PE EPP order confirmation requires a successfully authorized EPP order from the payment case; no order is created implicitly for evidence.");
    });
  });
});
