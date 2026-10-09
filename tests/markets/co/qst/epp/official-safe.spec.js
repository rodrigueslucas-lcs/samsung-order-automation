import { test, expect } from "@playwright/test";
import eppConfigModule from "../../../../../config/markets/epp";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import coEvidenceMetadata from "../../../../../utils/qstCoEvidenceMetadata";
import { addConfiguredEppProduct, openEppStore, validateBackToTop, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getCoQstEvidenceMetadata } = coEvidenceMetadata;
const cfg = () => getEppConfig("CO");

function evidence(testInfo, id) {
  recordBusinessEvidence(testInfo, getCoQstEvidenceMetadata(id));
}

function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "CO EPP product/cart scenarios require CO_EPP_QST_PDP_URL and CO_EPP_QST_SKU when the supplied environment URL is not already a PDP.");
}

test.describe("CO QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-24929 @qst @co @epp @safe - Facets/Filter on PLP", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-24929");
    await test.step("Open the official CO EPP PLP and validate a filter entry point", async () => {
      const current = cfg();
      const plp = String(process.env.CO_EPP_QST_PLP_URL || "").trim();
      test.skip(!plp, "CO_EPP_QST_PLP_URL is required to prove the official EPP facet scenario without guessing a category route.");
      await openEppStore(page, { ...current, entryUrl: new URL(plp) });
      const filter = page.getByRole("button", { name: /Filtrar|Filtro|Filter/i })
        .or(page.getByText(/Filtrar|Filtro|Filter/i))
        .filter({ visible: true }).first();
      await expect(filter).toBeVisible({ timeout: 60000 });
    });
  });

  test("SAM-24930 @qst @co @epp @safe - Able to add to Cart from PDP", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-24930");
    await test.step("Add the configured CO EPP product from PDP", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-24931 @qst @co @epp @safe - Cart page UI", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-24931");
    await test.step("Validate CO EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-24942 @qst @co @epp @safe - Step 1: Contact Details Section", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-24942");
    await test.step("Reach CO EPP checkout and validate contact details", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.proceedToCheckout();
      const contact = page.getByPlaceholder(/correo|email|nombre|name|tel[eé]fono|phone|documento/i)
        .or(page.locator('input[name="firstName"], input[name="lastName"], input[name="phone"], input[type="email"]'))
        .filter({ visible: true }).first();
      await expect(contact).toBeVisible({ timeout: 60000 });
    });
  });

  test("SAM-24952 @qst @co @epp @safe - Verify Back to Top", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-24952");
    await test.step("Validate Back to Top on the official CO EPP cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateBackToTop(page);
    });
  });

  test("SAM-24953 @blocked @destructive @qst @co @epp @registered - Payment using credit card with reg user", async ({}, testInfo) => {
    evidence(testInfo, "SAM-24953");
    await test.step("Keep the official CO EPP card-payment case represented without unauthorized order placement", async () => {
      test.skip(true, "CO EPP S2 requires corporate-email activation before checkout; card payment also requires explicit ALLOW_PAYMENT_SUBMIT authorization and runtime-proven EPP payment data.");
    });
  });
});
