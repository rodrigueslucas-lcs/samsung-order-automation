import HomePage from "../../../../pages/HomePage";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import { testData } from "../../../../utils/testData";

export async function openEppHome(page, config) {
  const home = new HomePage(page, { setupUrl: null, homeUrl: config.url.toString() });
  await home.openHome();
  const finalUrl = new URL(page.url());
  if (finalUrl.hostname !== config.hostname) {
    throw new Error(`EPP navigation left the configured staging host: ${finalUrl.origin}`);
  }
  return home;
}

export async function prepareEppCart(page, config) {
  const product = new ProductPage(page, {
    setupUrl: null,
    sku: config.smokeSku,
    pdpUrl: config.smokePdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
  const cart = new CartPage(page, {
    sku: config.smokeSku,
    cartUrl: config.cartUrl.toString(),
    productNamePattern: null,
  });
  await product.addConfiguredPdpToCart();
  return { product, cart };
}

export async function reachEppDelivery(page, config) {
  const { checkout } = await reachEppContact(page, config);
  await checkout.fillCustomerData(testData.customer);
  return { checkout, address: testData.address };
}

export async function reachEppContact(page, config) {
  const { cart } = await prepareEppCart(page, config);
  const checkout = new CheckoutPage(page);
  await cart.proceedToAuthenticatedCheckout();
  return { cart, checkout, customer: testData.customer };
}

export async function reachEppPayment(page, config) {
  const { checkout, address } = await reachEppDelivery(page, config);
  await checkout.validateAuthenticatedDeliveryForm();
  await checkout.fillAddress(address);
  await checkout.validateAddressValues(address);
  await checkout.selectShippingMethod();
  await checkout.acceptTerms();
  await checkout.continueToPayment();
  const payment = new PaymentPage(page);
  await payment.validatePaymentPage({ expectedPaymentMode: /.+/ });
  return { checkout, payment, address };
}
