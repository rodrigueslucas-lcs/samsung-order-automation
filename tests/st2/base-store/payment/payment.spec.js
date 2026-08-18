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

  // IMPORTANTE:
  // Estes são os métodos da baseline funcional do Checkout.
  // Não alterar essa lógica para os testes de Payment.
  await checkoutPage.selectShippingMethod();
  await checkoutPage.acceptTerms();
  await checkoutPage.continueToPayment();

  return paymentPage;
}

test.describe("ST2 - Base Store - Payment Page", () => {
  test("TC53 - Customer able to navigate to Payment Page, when click the BuyNow Button", async ({ page }) => {
    test.setTimeout(300000);

    const paymentPage = await reachPayment(page);

    await paymentPage.validatePaymentPage();
  });

  test("TC54 - Customer able to see Payment Page", async ({ page }) => {
    test.setTimeout(300000);

    const paymentPage = await reachPayment(page);

    await paymentPage.validatePaymentPage();
  });


  test("TC55 - Customer able to see the price break down", async ({ page }) => {
    test.setTimeout(300000);

    const paymentPage = await reachPayment(page);

    await paymentPage.validatePriceBreakdown();
  });


  test("TC56 - Customer able to see the address for Shipping and Billing", async ({ page }) => {
    test.setTimeout(300000);

    const paymentPage = await reachPayment(page);

    await paymentPage.validateShippingAndBillingAddress(testData.address);
  });

  test("TC57 - Customer able to see all available Payment mode", async ({ page }) => {
    test.setTimeout(300000);

    const paymentPage = await reachPayment(page);

    await paymentPage.validateAvailablePaymentModes();
  });
});
