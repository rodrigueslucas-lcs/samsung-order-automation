import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import GuestLoginPage from "../../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../../pages/CheckoutPage";
import PaymentPage from "../../../../../pages/PaymentPage";
import { testData } from "../../../../../utils/testData";
import { test } from "@playwright/test";

async function bootstrapPeStorefront(page, config) {
  if (!config.setupUrl) return;
  await test.step(`Bootstrap PE ${config.environment || "staging"} storefront session`, async () => {
    const current = new URL(page.url());
    if (current.hostname === config.baseUrl.hostname && current.pathname.startsWith("/pe")) return;
    await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText(/you can access pages now/i).waitFor({ state: "visible", timeout: 20000 });
  });
}

export async function addConfiguredProductToPeCart(page, config) {
  await bootstrapPeStorefront(page, config);
  const product = new ProductPage(page, {
    setupUrl: config.setupUrl?.href || null,
    sku: config.sku,
    pdpUrl: config.pdpUrl.href,
    cartUrl: config.cartUrl.href,
  });
  await test.step("Open controlled PE PDP and add configured product to cart", async () => {
    await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  });

  return new CartPage(page, {
    cartUrl: config.cartUrl.href,
    sku: config.sku,
    productNamePattern: null,
    currencyPattern: /S\/\s*[\d,.]+/,
  });
}

export async function reachPeGuestDelivery(page, config) {
  const cart = await addConfiguredProductToPeCart(page, config);
  await test.step("Continue from cart to guest checkout", async () => {
    await cart.proceedToCheckout();
  });

  const guest = new GuestLoginPage(page);
  await test.step("Continue as guest with isolated QST email", async () => {
    await guest.checkoutAsGuest(`pe-qst-${Date.now()}@mailinator.com`);
  });

  const checkout = new CheckoutPage(page);
  await test.step("Complete customer contact information", async () => {
    await checkout.fillCustomerData(testData.customer);
  });
  return { cart, checkout };
}

export async function reachPeGuestPayment(page, config, options = {}) {
  const { cart, checkout } = await reachPeGuestDelivery(page, config);
  await test.step("Complete delivery address", async () => {
    await checkout.fillAddress(options.address || testData.address);
  });
  await test.step("Select shipping method and accept terms", async () => {
    await checkout.selectShippingMethod();
    await checkout.acceptTerms();
  });
  await test.step("Continue to payment", async () => {
    await checkout.continueToPayment({ expectedPaymentMode: options.expectedPaymentMode });
  });
  const payment = new PaymentPage(page);
  await payment.validatePaymentPage({ expectedPaymentMode: options.expectedPaymentMode });
  return { cart, checkout, payment };
}

export async function reachPeRegisteredDelivery(page, config) {
  const cleanCart = new CartPage(page, { cartUrl: config.cartUrl.href });
  await test.step("Cart · Reset authenticated cart", () =>
    cleanCart.clearPeCartAndConfirmEmpty()
  );
  const cart = await addConfiguredProductToPeCart(page, config);
  await test.step("Checkout · Continue as registered customer", () =>
    cart.proceedToAuthenticatedCheckout()
  );

  const checkout = new CheckoutPage(page);
  await test.step("Contact · Validate registered customer state", async () => {
    const firstName = page.getByRole("textbox", { name: "firstName" });
    const contactVisible = await firstName.isVisible().catch(() => false);
    if (contactVisible) {
      await checkout.fillCustomerData(testData.customer);
      return;
    }

    const deliverySurface = page
      .getByRole("tabpanel", { name: "Envío", exact: true })
      .or(page.getByText(/Dirección guardada|Nueva dirección|datos de env[ií]o/i).filter({ visible: true }));
    await deliverySurface.first().waitFor({ state: "visible", timeout: 30000 });
  });
  return { cart, checkout };
}

export async function reachPeRegisteredPayment(page, config, options = {}) {
  const { cart, checkout } = await reachPeRegisteredDelivery(page, config);
  const newAddress = page.getByRole("tabpanel", { name: "Envío", exact: true }).getByRole("radio", {
    name: "Nueva dirección",
    exact: true,
  });
  await test.step("Delivery · Select new address", async () => {
    await newAddress.waitFor({ state: "visible", timeout: 30000 });
    await newAddress.locator("xpath=ancestor::mat-radio-button[1]").click();
    if (!(await newAddress.isChecked())) throw new Error("PE delivery did not switch to the new-address mode.");
  });
  await test.step("Delivery · Fill shipping address", () =>
    checkout.fillAddress(options.address || testData.address)
  );

  await test.step("Delivery · Keep profile data unchanged", async () => {
    const saveAddress = page.getByRole("checkbox", {
      name: /Guardar datos de env[ií]o en Mi cuenta/i,
    });
    if (await saveAddress.isVisible().catch(() => false) && await saveAddress.isChecked()) {
      await saveAddress.uncheck();
    }
  });

  await test.step("Delivery · Select shipping method", () => checkout.selectShippingMethod());
  await test.step("Checkout · Accept terms", () => checkout.acceptTerms());
  await test.step("Payment · Continue to payment", () =>
    checkout.continueToPayment({ expectedPaymentMode: options.expectedPaymentMode })
  );
  const payment = new PaymentPage(page);
  await test.step("Payment · Validate payment page", () =>
    payment.validatePaymentPage({ expectedPaymentMode: options.expectedPaymentMode })
  );
  return { cart, checkout, payment };
}
