import { test, expect } from "@playwright/test";
import HomePage from "../../../../../pages/HomePage";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import peConfigModule from "../../../../../config/markets/pe";
import storefrontAccess from "../../../../../flows/smb/storefrontAccess";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";

const { getPeS1QstConfig } = peConfigModule;
const { openStorefront } = storefrontAccess;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

function requirePeStorefront() {
  test.skip(
    !process.env.PE_STOREFRONT_URL,
    "Set PE_STOREFRONT_URL to the verified PE S1 storefront root, for example an https URL ending in /pe/."
  );
  return getPeS1QstConfig();
}

function requirePeProductConfig() {
  const config = requirePeStorefront();
  test.skip(
    !config.sku || !config.pdpUrl,
    "Set PE_QST_SKU and PE_QST_PDP_URL to a verified PE S1 PDP before running product/cart reuse tests."
  );
  return config;
}

function recordOfficialEvidence(testInfo, zephyrId) {
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(zephyrId));
}

async function addConfiguredProductToPeCart(page, config) {
  if (config.setupUrl) {
    await openStorefront(page, {
      baseUrl: config.baseUrl,
      setupUrl: config.setupUrl,
      expectedMarket: "PE",
    });
  }

  const product = new ProductPage(page, {
    setupUrl: null,
    sku: config.sku,
    pdpUrl: config.pdpUrl.href,
    cartUrl: config.cartUrl.href,
  });
  await product.addConfiguredPdpToCart({ waitForCartMutation: true });

  return new CartPage(page, {
    cartUrl: config.cartUrl.href,
    sku: config.sku,
    productNamePattern: null,
    currencyPattern: /S\/\s*[\d,.]+/,
  });
}

test("SAM-25079 @qst @pe @base-store @safe @reuse - UI validation in desktop view baseline", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeStorefront();
  recordOfficialEvidence(testInfo, "SAM-25079");

  await openStorefront(page, {
    baseUrl: config.baseUrl,
    setupUrl: config.setupUrl,
    expectedMarket: "PE",
  });

  const home = new HomePage(page, {
    setupUrl: null,
    homeUrl: config.baseUrl.href,
    footerHeadingPattern: /Tienda|Shop/i,
  });
  const attributes = await home.validateHomepageAttributes();
  expect(attributes.headerVisible).toBe(true);
  expect(attributes.footerVisible).toBe(true);

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Homepage baseline only; official desktop UI case still requires all-page, broken-image, copyright and spacing validation.",
  });
});

test("SAM-25061 @qst @pe @base-store @safe @reuse - Able to add to Cart from PDP", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25061");

  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.validateProductInCart();

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Live S1 PDP add-to-cart is exercised; official PLP-to-PDP origin still needs explicit proof before Full coverage.",
  });
});

test("SAM-25062 @qst @pe @base-store @safe @reuse - Cart page UI baseline", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25062");

  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.validateProductInCart();
  const summary = await cart.validateOrderSummary();
  await cart.validateExternalServicesVisible();
  await cart.validateCartFooter();

  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "SKU, summary, services and footer baseline; price/thumbnail/info-icon acceptance remains to be proven explicitly.",
  });
});

test("SAM-25064 @qst @pe @base-store @safe @reuse - Order Summary on cart page baseline", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25064");

  const cart = await addConfiguredProductToPeCart(page, config);
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Subtotal/Total baseline only; coupon, savings and info text still require official S1 assertions.",
  });
});

test("SAM-25081 @qst @pe @base-store @safe @reuse - Checkout button on cart page", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25081");

  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.validateCheckoutButton();
  await cart.proceedToCheckout();
});
