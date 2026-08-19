import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import { testData } from "../../../../utils/testData";

async function reachPayment(page) {
  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);
  const guestLoginPage = new GuestLoginPage(page);
  const checkoutPage = new CheckoutPage(page);
  const paymentPage = new PaymentPage(page);

  await productPage.validateProductLoaded();
  await productPage.addToCart();

  await cartPage.validateProductInCart();
  await cartPage.proceedToCheckout();

  await guestLoginPage.checkoutAsGuest(testData.customer.email);

  await checkoutPage.fillCustomerData(testData.customer);
  await checkoutPage.fillAddress(testData.address);

  // BASELINE FUNCIONAL DO CHECKOUT.
  // NÃO ALTERAR ESSA LÓGICA NOS TESTES DE PAYMENT.
  await checkoutPage.selectShippingMethod();
  await checkoutPage.acceptTerms();
  await checkoutPage.continueToPayment();

  return paymentPage;
}

test.describe("ST2 - Base Store - Payment Page", () => {
  test.describe.configure({ mode: "serial" });

  let context;
  let sharedPage;
  let paymentPage;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300000);

    // Faz o checkout UMA ÚNICA VEZ para todo o bloco de Payment.
    context = await browser.newContext();
    sharedPage = await context.newPage();

    paymentPage = await reachPayment(sharedPage);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("TC53 - Customer able to navigate to Payment Page, when click the BuyNow Button", async () => {
    test.setTimeout(120000);

    await paymentPage.validatePaymentPage();
  });

  test("TC54 - Customer able to see Payment Page", async () => {
    test.setTimeout(120000);

    await paymentPage.validatePaymentPage();
  });

  test("TC55 - Customer able to see the price break down", async () => {
    test.setTimeout(120000);

    await paymentPage.validatePriceBreakdown();
  });

  test("TC56 - Customer able to see the address for Shipping and Billing", async () => {
    test.setTimeout(120000);

    await paymentPage.validateShippingAndBillingAddress(testData.address);
  });

  test("TC57 - Customer able to see all available Payment mode", async () => {
    test.setTimeout(120000);

    await paymentPage.validateAvailablePaymentModes();
  });

  test("TC58 - Customer able to complete order using one payment mode", async () => {
    test.setTimeout(300000);

    await paymentPage.selectCreditCard();
    await paymentPage.fillCardData(testData.card);
    await paymentPage.placeOrder();
  });
});
