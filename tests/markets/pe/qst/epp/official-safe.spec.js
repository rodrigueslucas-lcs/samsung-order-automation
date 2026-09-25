import { test, expect } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import peAuthStateModule from "../../../../../utils/peAuthState";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";

const { PE_AUTH_STATE_PATH, getPeAuthState, hasPeAuthState } = peAuthStateModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

function eppConfig() {
  const base = process.env.PE_EPP_STOREFRONT_URL;
  const pdp = process.env.PE_EPP_QST_PDP_URL;
  const sku = String(process.env.PE_EPP_QST_SKU || "").trim();
  test.skip(!base, "PE_EPP_STOREFRONT_URL is required for official PE EPP QST.");
  const baseUrl = new URL(base);
  if (!["stg.shop.samsung.com", "stg2.shop.samsung.com"].includes(baseUrl.hostname) || !baseUrl.pathname.toLowerCase().startsWith("/pe/")) {
    throw new Error("PE_EPP_STOREFRONT_URL must stay on the PE S1/S2 staging storefront.");
  }
  return { baseUrl, pdpUrl: pdp ? new URL(pdp) : null, sku, cartUrl: new URL("/pe/cart", baseUrl.origin) };
}
function evidence(testInfo, id) { recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(id)); }
async function addEppProduct(page, cfg) {
  test.skip(!cfg.pdpUrl || !cfg.sku, "PE_EPP_QST_PDP_URL and PE_EPP_QST_SKU are required for EPP product/cart coverage.");
  if (cfg.pdpUrl.hostname !== cfg.baseUrl.hostname || !cfg.pdpUrl.pathname.startsWith("/pe/")) throw new Error("PE_EPP_QST_PDP_URL must stay on the configured PE staging host.");
  const product = new ProductPage(page, { setupUrl: null, sku: cfg.sku, pdpUrl: cfg.pdpUrl.href, cartUrl: cfg.cartUrl.href });
  await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  return new CartPage(page, { cartUrl: cfg.cartUrl.href, sku: cfg.sku, productNamePattern: null, currencyPattern: /S\/\s*[\d,.]+/ });
}

test.describe("PE QST - official EPP safe checkpoints", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25109 @qst @pe @epp @safe @registered - EPP Login", async ({ browser }, testInfo) => {
    evidence(testInfo, "SAM-25109");
    const cfg = eppConfig();
    test.skip(!hasPeAuthState(), "Authenticated PE state is required for EPP login proof.");
    const context = await browser.newContext({ storageState: PE_AUTH_STATE_PATH });
    await getPeAuthState().applyAuthSessionStorage(context);
    const page = await context.newPage();
    await page.goto(cfg.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).toHaveURL((url) => url.hostname === cfg.baseUrl.hostname);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 60000 });
    await context.close();
  });

  test("SAM-25113 @qst @pe @epp @safe - Able to add to Cart from PDP", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25113");
    const cart = await addEppProduct(page, eppConfig());
    await cart.validateProductInCart();
  });

  test("SAM-25114 @qst @pe @epp @safe - Cart page UI", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25114");
    const cart = await addEppProduct(page, eppConfig());
    await cart.validateProductInCart();
    const summary = await cart.validateOrderSummary();
    expect(summary.subtotal).toBeTruthy();
    expect(summary.total).toBeTruthy();
    await cart.validateCartFooter();
  });

  test("SAM-25125 @qst @pe @epp @safe - Checkout button on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25125");
    const cart = await addEppProduct(page, eppConfig());
    await cart.validateCheckoutButton();
    await cart.proceedToCheckout();
    await expect(page).toHaveURL(/checkout|login|account/i);
  });
});
