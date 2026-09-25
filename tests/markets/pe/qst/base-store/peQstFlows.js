import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import GuestLoginPage from "../../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../../pages/CheckoutPage";
import PaymentPage from "../../../../../pages/PaymentPage";
import { testData } from "../../../../../utils/testData";

export async function addConfiguredProductToPeCart(page, config) {
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

export async function reachPeGuestDelivery(page, config) {
  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.proceedToCheckout();

  const guest = new GuestLoginPage(page);
  await guest.checkoutAsGuest(`pe-qst-${Date.now()}@mailinator.com`);

  const checkout = new CheckoutPage(page);
  await checkout.fillCustomerData(testData.customer);
  return { cart, checkout };
}

export async function reachPeGuestPayment(page, config, options = {}) {
  const { cart, checkout } = await reachPeGuestDelivery(page, config);
  await checkout.fillAddress(options.address || testData.address);
  await checkout.selectShippingMethod();
  await checkout.acceptTerms();
  await checkout.continueToPayment({ expectedPaymentMode: options.expectedPaymentMode });
  const payment = new PaymentPage(page);
  await payment.validatePaymentPage({ expectedPaymentMode: options.expectedPaymentMode });
  return { cart, checkout, payment };
}

export async function reachPeRegisteredDelivery(page, config) {
  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.proceedToAuthenticatedCheckout();

  const checkout = new CheckoutPage(page);
  await checkout.fillCustomerData(testData.customer);
  return { cart, checkout };
}

export async function reachPeRegisteredPayment(page, config, options = {}) {
  const { cart, checkout } = await reachPeRegisteredDelivery(page, config);
  const newAddress = page.getByRole("radio", {
    name: "Nueva dirección",
    exact: true,
  });
  if (await newAddress.isVisible().catch(() => false)) {
    await newAddress.check();
  }
  await checkout.fillAddress(options.address || testData.address);

  const saveAddress = page.getByRole("checkbox", {
    name: /Guardar datos de env[ií]o en Mi cuenta/i,
  });
  if (await saveAddress.isVisible().catch(() => false) && await saveAddress.isChecked()) {
    await saveAddress.uncheck();
  }

  await checkout.selectShippingMethod();
  await checkout.acceptTerms();
  await checkout.continueToPayment({ expectedPaymentMode: options.expectedPaymentMode });
  const payment = new PaymentPage(page);
  await payment.validatePaymentPage({ expectedPaymentMode: options.expectedPaymentMode });
  return { cart, checkout, payment };
}
