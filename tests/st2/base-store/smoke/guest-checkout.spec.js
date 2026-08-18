import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CartPage from "../../../../pages/CartPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import OrderConfirmationPage from "../../../../pages/OrderConfirmationPage";

import { testData } from "../../../../utils/testData";

test.describe("ST2 - Base Store - Guest Customer Order Journey", () => {

  test("E2E - Guest checkout using Credit Card", async ({ page }) => {
    test.setTimeout(300000);

    const productPage = new ProductPage(page);
    const guestLoginPage = new GuestLoginPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const paymentPage = new PaymentPage(page);
    const orderConfirmationPage = new OrderConfirmationPage(page);

    await test.step("TC15/TC16 - Cart Page and added product displayed correctly", async () => {
      await productPage.validateProductLoaded();
      await productPage.addToCart();

      await cartPage.validateProductInCart();
    });

    await test.step("TC20/TC33 - Checkout button and navigation to Checkout", async () => {
      await cartPage.proceedToCheckout();
    });

    await test.step("TC34 - Checkout Login Page", async () => {
      await guestLoginPage.checkoutAsGuest(testData.customer.email);
    });

    await test.step("TC35/TC42-TC47 - Checkout Address Page and customer address data", async () => {
      await checkoutPage.fillCustomerData(testData.customer);
      await checkoutPage.fillAddress(testData.address);
    });

    await test.step("TC49/TC50 - Available delivery mode and delivery selection", async () => {
      await checkoutPage.selectShippingMethod();
    });

    await test.step("TC53 - Navigate to Payment Page", async () => {
      await checkoutPage.acceptTerms();
      await checkoutPage.continueToPayment();
    });

    await test.step("TC54/TC57 - Payment Page and Credit Card payment mode", async () => {
      await paymentPage.selectCreditCard();
      await paymentPage.fillCardData(testData.card);
    });

    await test.step("TC58/TC77 - Complete order using Credit Card", async () => {
      await paymentPage.placeOrder();
    });

    await test.step("TC62 - Order Confirmation Page displayed", async () => {
      await orderConfirmationPage.validateOrderCreated();
    });
  });

});
