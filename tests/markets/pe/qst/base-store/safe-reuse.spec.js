import { test, expect } from "@playwright/test";
import HomePage from "../../../../../pages/HomePage";
import GuestLoginPage from "../../../../../pages/GuestLoginPage";
import peConfigModule from "../../../../../config/markets/pe";
import storefrontAccess from "../../../../../flows/smb/storefrontAccess";
import cartPresentation from "../../../../../flows/smb/cartPresentation";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { testData } from "../../../../../utils/testData";
import {
  addConfiguredProductToPeCart,
  reachPeGuestDelivery,
} from "./peQstFlows";

const { getPeQstConfig } = peConfigModule;
const { openStorefront } = storefrontAccess;
const { inspectAvailableServices, validateCartItemPresentation } = cartPresentation;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

function requirePeStorefront() {
  test.skip(
    !process.env.PE_STOREFRONT_URL,
    "Set PE_STOREFRONT_URL to the verified PE storefront root, for example an https URL ending in /pe/."
  );
  return getPeQstConfig();
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

  await test.step("Open PE storefront in desktop context", () =>
    openStorefront(page, {
      baseUrl: config.baseUrl,
      setupUrl: config.setupUrl,
      expectedMarket: "PE",
    })
  );

  const home = new HomePage(page, {
    setupUrl: null,
    homeUrl: config.baseUrl.href,
    footerHeadingPattern: /Tienda|Shop/i,
  });
  await test.step("Validate desktop header and footer", async () => {
    const attributes = await home.validateHomepageAttributes();
    expect(attributes.headerVisible).toBe(true);
    expect(attributes.footerVisible).toBe(true);
  });

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Homepage baseline only; official desktop UI case still requires all-page, broken-image, copyright and spacing validation.",
  });
});

test("SAM-25061 @qst @pe @base-store @safe @reuse - Able to add to Cart from PDP", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25061");

  const cart = await test.step("Prepare PE cart with controlled product", () =>
    addConfiguredProductToPeCart(page, config)
  );
  await test.step("Validate configured product is present in cart", () =>
    cart.validateProductInCart()
  );

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Uses the proven PE ST2 QST SKU by default and exercises the configured PE PDP add-to-cart path; live target-environment proof is still required before coverage promotion.",
  });
});

test("SAM-25062 @qst @pe @base-store @safe @reuse - Cart page UI baseline", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25062");

  const cart = await test.step("Prepare PE cart with controlled product", () =>
    addConfiguredProductToPeCart(page, config)
  );
  await test.step("Validate cart item presentation", async () => {
    await cart.validateProductInCart();
    await validateCartItemPresentation(page, {
      sku: config.sku,
      currencyPattern: /S\/\s*[\d,.]+/,
    });
  });
  const summary = await test.step("Validate order summary", () => cart.validateOrderSummary());
  const services = await test.step("Inspect available cart services", () => inspectAvailableServices(page));
  await test.step("Validate cart footer", () => cart.validateCartFooter());

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

  const cart = await test.step("Prepare PE cart with controlled product", () =>
    addConfiguredProductToPeCart(page, config)
  );
  const summary = await test.step("Validate cart order summary totals", () => cart.validateOrderSummary());
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Subtotal/Total baseline only; coupon, savings and info text still require official target-environment assertions.",
  });
});

test("SAM-25081 @qst @pe @base-store @safe @reuse - Checkout button on cart page", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25081");

  const cart = await test.step("Prepare PE cart with controlled product", () =>
    addConfiguredProductToPeCart(page, config)
  );
  await test.step("Validate checkout CTA", () => cart.validateCheckoutButton());
  await test.step("Continue from cart to checkout", () => cart.proceedToCheckout());
});

test("SAM-25080 @qst @pe @base-store @safe @reuse - Login from Checkout page", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25080");

  const cart = await test.step("Prepare PE cart with controlled product", () =>
    addConfiguredProductToPeCart(page, config)
  );
  await test.step("Continue from cart to checkout", () => cart.proceedToCheckout());
  const guestLogin = new GuestLoginPage(page);
  await test.step("Open Samsung Account login from checkout", () =>
    guestLogin.openRegisteredLoginFromCheckout()
  );

  await test.step("Validate Samsung Account destination", async () => {
    expect(new URL(page.url()).hostname).toBe("account.samsung.com");
  });
  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "The checkout login action is proven to route to the legitimate Samsung Account flow. No credentials or SSO bypass are automated here.",
  });
});

test("SAM-25088 @qst @pe @base-store @safe @guest @reuse - Save option not visible", async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25088");

  await test.step("Reach guest delivery step", () => reachPeGuestDelivery(page, config));
  const saveAddress = page
    .getByRole("checkbox", { name: /Guardar datos de env[ií]o en Mi cuenta/i })
    .filter({ visible: true });
  await test.step("Validate Save address option is absent for guest", async () => {
    await expect(saveAddress).toHaveCount(0);
  });
});

test("SAM-25089 @qst @pe @base-store @safe @guest @reuse - Different billing and shipping", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25089");

  const { checkout } = await test.step("Reach guest delivery step", () =>
    reachPeGuestDelivery(page, config)
  );
  await test.step("Fill shipping address", () => checkout.fillAddress(testData.address));
  await test.step("Validate different billing address", () =>
    checkout.validateDifferentBillingAddress(testData.billingAddress)
  );

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Shipping and a distinct billing address are populated and validated in checkout without payment or order submission.",
  });
});

test("SAM-25090 @qst @pe @base-store @safe @guest @reuse - Validate home delivery", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const config = requirePeProductConfig();
  recordOfficialEvidence(testInfo, "SAM-25090");

  const { checkout } = await test.step("Reach guest delivery step", () =>
    reachPeGuestDelivery(page, config)
  );
  await test.step("Fill delivery address", () => checkout.fillAddress(testData.address));
  const delivery = page.getByRole("listitem").filter({ hasText: /Para envíos a provincias/i });
  await test.step("Select province home delivery", async () => {
    await expect(delivery).toBeVisible({ timeout: 30000 });
    await delivery.click();
  });
  const summary = page.getByRole("heading", { name: "Resumen de la orden", exact: true }).locator("..");
  await test.step("Validate regular delivery in order summary", async () => {
    await expect(summary.getByText(/Envío Regular Gratis/i).first()).toBeVisible({ timeout: 30000 });
  });

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "The PE province home-delivery option and its Order Summary selection are validated without continuing to payment. Calendar and order placement remain unproven.",
  });
});
