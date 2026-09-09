import { test, expect } from "@playwright/test";
import HomePage from "../../../../../pages/HomePage";
import GuestLoginPage from "../../../../../pages/GuestLoginPage";
import peConfigModule from "../../../../../config/markets/pe";
import storefrontAccess from "../../../../../flows/smb/storefrontAccess";
import cartPresentation from "../../../../../flows/smb/cartPresentation";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { testData } from "../../../../../utils/testData";
import {
  addConfiguredProductToPeCart,
  reachPeGuestDelivery,
} from "./peQstFlows";

const { getPeS1QstConfig } = peConfigModule;
const { openStorefront } = storefrontAccess;
const { inspectAvailableServices, validateCartItemPresentation } = cartPresentation;
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
    "A verified PE product is required before running product/cart reuse tests."
  );
  return config;
}

function recordOfficialEvidence(testInfo, zephyrId) {
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(zephyrId));
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
    description: "Uses the proven PE ST2 QST SKU by default and exercises the S1 PDP add-to-cart path; live S1 proof is still required before coverage promotion.",
  });
});

test("SAM-25062 @qst @pe @base-store @safe @reuse - Cart page UI baseline", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25062");

  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.validateProductInCart();
  await validateCartItemPresentation(page, {
    sku: config.sku,
    currencyPattern: /S\/\s*[\d,.]+/,
  });
  const summary = await cart.validateOrderSummary();
  const services = await inspectAvailableServices(page);
  await cart.validateCartFooter();

  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();

  testInfo.annotations.push({
    type: "qst-cart-services",
    description: services.visible ? "Available services are visible for the configured product." : "No available service was visible for the configured product; official criterion is services if any.",
  });
  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "SKU, item price, thumbnail, order summary and footer are asserted. Info icons remain to be proven explicitly before Full coverage.",
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

test("SAM-25080 @qst @pe @base-store @safe @reuse - Login from Checkout page", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25080");

  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.proceedToCheckout();
  const guestLogin = new GuestLoginPage(page);
  await guestLogin.openRegisteredLoginFromCheckout();

  expect(new URL(page.url()).hostname).toBe("account.samsung.com");
  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "The checkout login action is proven to route to the legitimate Samsung Account flow. No credentials or SSO bypass are automated here.",
  });
});

test("SAM-25088 @qst @pe @base-store @safe @guest @reuse - Save option not visible", async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25088");

  await reachPeGuestDelivery(page, config);
  const saveAddress = page
    .getByRole("checkbox", { name: /Guardar datos de env[ií]o en Mi cuenta/i })
    .filter({ visible: true });
  await expect(saveAddress).toHaveCount(0);
});

test("SAM-25089 @qst @pe @base-store @safe @guest @reuse - Different billing and shipping", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25089");

  const { checkout } = await reachPeGuestDelivery(page, config);
  await checkout.fillAddress(testData.address);
  await checkout.validateDifferentBillingAddress(testData.billingAddress);

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Shipping and a distinct billing address are populated and validated in checkout without payment or order submission.",
  });
});

test("SAM-25090 @qst @pe @base-store @safe @guest @reuse - Validate home delivery", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25090");

  const { checkout } = await reachPeGuestDelivery(page, config);
  await checkout.fillAddress(testData.address);
  await checkout.validateAvailableDeliveryModes();
  await checkout.validateDeliveryModeSelection();

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Available PE delivery modes and a regular-delivery selection reflected in Order Summary are validated without continuing to payment.",
  });
});
