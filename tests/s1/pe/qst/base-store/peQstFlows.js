import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import GuestLoginPage from "../../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../../pages/CheckoutPage";
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

export async function reachPeRegisteredDelivery(page, config) {
  const cart = await addConfiguredProductToPeCart(page, config);
  await cart.proceedToAuthenticatedCheckout();

  const checkout = new CheckoutPage(page);
  await checkout.fillCustomerData(testData.customer);
  return { cart, checkout };
}
