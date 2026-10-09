import { test, expect } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";

function configuredProduct(page, config) {
  return new ProductPage(page, {
    setupUrl: config.bootstrapUrl.toString(),
    sku: config.sku,
    pdpUrl: config.pdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
}

function configuredCart(page, config) {
  return new CartPage(page, {
    cartUrl: config.cartUrl.toString(),
    sku: config.sku,
    productNamePattern: null,
    orderSummaryPattern: /Resumen de tu pedido/i,
    totalPattern: /Total con IVA/i,
    checkoutButtonPattern: /Finalizar Compra/i,
    currencyPattern: /\$\s*[\d,.]+/,
  });
}

async function ensureMxBootstrapReady(page, config) {
  const currentUrl = new URL(page.url());
  const alreadyOnMxStorefront =
    currentUrl.hostname === config.hostname &&
    (currentUrl.pathname === "/mx" || currentUrl.pathname.startsWith("/mx/"));

  if (alreadyOnMxStorefront) return;

  await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  await page.goto(config.baseUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
}

async function fillGuestEmailOnContactInfo(page, email) {
  const contactEmail = page
    .getByRole("textbox", { name: "email", exact: true })
    .filter({ visible: true })
    .first();
  await contactEmail.waitFor({ state: "visible", timeout: 30000 });
  await contactEmail.fill(email);
  await expect(contactEmail).toHaveValue(email);
}

async function startMxGuestCheckout(page, cart, email) {
  let proceedError = null;
  try {
    await cart.proceedToCheckout();
  } catch (error) {
    proceedError = error;
  }

  const checkout = new MxCheckoutPage(page);
  if (/CHECKOUT_STEP_CONTACT_INFO/i.test(page.url())) {
    // S2 can reuse a guest checkout shell/session and land directly on Contact
    // Info after Finalizar Compra. This is a valid guest path only when the
    // required contact email field is present and we can set the requested email.
    await fillGuestEmailOnContactInfo(page, email);
    return checkout;
  }

  if (proceedError) {
    const mainText = await page
      .getByRole("main")
      .innerText({ timeout: 5000 })
      .catch(() => "");
    throw new Error(
      `MX guest checkout did not reach Guest Login or Contact Info. ` +
      `url=${page.url()} main=${String(mainText || "").replace(/\s+/g, " ").trim().slice(0, 500) || "<empty>"}. ` +
      `Original error: ${proceedError.message || proceedError}`
    );
  }

  await checkout.startGuest(email);
  return checkout;
}

async function fillGuestContactWithRecovery(page, checkout, email) {
  const payload = { firstName: "MX", lastName: "Automation", phone: "5512345678" };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await checkout.fillContact(payload);
      return;
    } catch (error) {
      if (/CHECKOUT_STEP_DELIVERY/i.test(page.url())) return;
      if (!/CHECKOUT_STEP_CONTACT_INFO/i.test(page.url()) || attempt === 2) throw error;

      console.log("[mx-checkout] Contact -> Delivery remained loading; reloading Contact once and retrying the same safe data.");
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await fillGuestEmailOnContactInfo(page, email);
    }
  }
}

export async function continueMxDeliveryToPaymentWithRecovery(page, checkout, { postalCode = "01000" } = {}) {
  let transitionError = null;
  try {
    await checkout.selectDeliveryAndContinue();
  } catch (error) {
    transitionError = error;
    // Known race: the URL can switch to PAYMENT immediately after the internal
    // transition watcher times out. PAYMENT is not an unexpected URL; prove the
    // payment UI instead of failing on that timing boundary.
    if (!/CHECKOUT_STEP_PAYMENT/i.test(page.url())) throw error;
    console.log(`[mx-checkout] Delivery -> Payment reached PAYMENT after transition watcher: ${error.message || error}`);
  }

  const paymentRegion = page.getByRole("region", { name: /3\. M[eé]todos de Pago/i });
  let ready = await paymentRegion
    .waitFor({ state: "visible", timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  if (!ready) {
    if (!/CHECKOUT_STEP_PAYMENT/i.test(page.url())) {
      if (transitionError) throw transitionError;
      throw new Error(`MX Payment UI did not render and checkout left Payment: ${page.url()}`);
    }

    // A PAYMENT URL with a permanent skeleton is safe to reload once because no
    // payment/order submission has happened yet. Do not add blind retries here.
    console.log("[mx-checkout] Payment URL loaded but payment UI stayed skeleton; performing one controlled reload.");
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    ready = await paymentRegion
      .waitFor({ state: "visible", timeout: 60000 })
      .then(() => true)
      .catch(() => false);
  }

  if (!ready) {
    throw new Error(
      `MX Payment UI remained unrendered after one controlled reload; current URL: ${page.url()}`
    );
  }

  await checkout.validatePaymentPage({ postalCode });
}

export async function reachMxGuestDelivery(page, config, email) {
  await test.step("Open MX storefront and add the controlled product to cart", async () => {
    await ensureMxBootstrapReady(page, config);
    const product = configuredProduct(page, config);
    // Do not leave the PDP until the cart POST completes. Navigating to /cart
    // immediately after the click can abort the request and render an empty cart.
    await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  });

  const cart = configuredCart(page, config);
  const checkout = await test.step("Open guest checkout and reach Contact Information", async () => {
    return startMxGuestCheckout(page, cart, email);
  });

  await test.step("Fill mandatory customer details and stabilize Contact -> Delivery", async () => {
    await fillGuestContactWithRecovery(page, checkout, email);
    await checkout.validateCheckoutSummary(config.sku);
  });

  return { checkout, cart };
}

export async function reachMxGuestPayment(page, config, email) {
  const { checkout } = await reachMxGuestDelivery(page, config, email);
  const address = await test.step("Fill the guest delivery address", async () => checkout.fillDelivery({
    postalCode: "01000",
    street: "Avenida Revolucion",
    exteriorNumber: "1000",
  }));
  await test.step("Continue from Delivery and wait for a stable Payment UI", async () => {
    await continueMxDeliveryToPaymentWithRecovery(page, checkout, { postalCode: "01000" });
  });
  return { checkout, address };
}

export async function reachMxRegisteredDelivery(page, config, { addToCartDiagnostics } = {}) {
  await test.step("Prepare a controlled registered-user cart", async () => {
    await ensureMxBootstrapReady(page, config);
    const cart = configuredCart(page, config);
    await cart.clearMxCartAndConfirmEmpty();
    await configuredProduct(page, config).addConfiguredPdpToCart({
      waitForCartMutation: true,
      diagnostics: addToCartDiagnostics,
    });
    await cart.validateControlledSingleSku(config.sku);
    await cart.proceedToAuthenticatedCheckout();
  });

  const checkout = new MxCheckoutPage(page);
  await test.step("Fill registered contact details and reach Delivery", async () => {
    await checkout.fillRegisteredContact({
      firstName: "MX",
      lastName: "Automation",
      phone: "5512345678",
    });
    await checkout.validateCheckoutSummary(config.sku);
  });
  return { checkout, cart: configuredCart(page, config) };
}

export async function reachMxRegisteredPayment(page, config) {
  const { checkout } = await reachMxRegisteredDelivery(page, config);
  const newAddress = page
    .getByRole("radio", { name: /Nueva direcci[oó]n|New address/i })
    .filter({ visible: true })
    .first();
  const newAddressAvailable = await newAddress
    .waitFor({ state: "visible", timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (newAddressAvailable) {
    await newAddress.check({ force: true });
    await expect(newAddress).toBeChecked({ timeout: 30000 });
  }
  const address = await test.step("Fill the registered delivery address", async () => checkout.fillDelivery(
    { postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" },
    { registered: true }
  ));
  await test.step("Continue from Delivery and wait for a stable Payment UI", async () => {
    await continueMxDeliveryToPaymentWithRecovery(page, checkout, { postalCode: "01000" });
  });
  return { checkout, address };
}
