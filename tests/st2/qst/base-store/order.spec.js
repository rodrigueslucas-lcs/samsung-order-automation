import { test, expect } from "@playwright/test";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import OrderConfirmationPage from "../../../../pages/OrderConfirmationPage";
import { testData } from "../../../../utils/testData";
import { annotateQstExecution } from "../../../../utils/qstExecutionSummary";

test("@destructive QST-BS-13 QST-BS-14 @qst @qst-normal @qst-modified @base-store - Payment and Order Confirmation", async ({ page }, testInfo) => {
  test.skip(
    process.env.ALLOW_PAYMENT_SUBMIT !== "1",
    "Set ALLOW_PAYMENT_SUBMIT=1 to authorize exactly one ST2 Place Order submit."
  );
  test.setTimeout(1200000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });

  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const guestLogin = new GuestLoginPage(page);
  const checkout = new CheckoutPage(page);
  const payment = new PaymentPage(page);
  const confirmation = new OrderConfirmationPage(page);
  const inbox = `qst${Date.now().toString().slice(-10)}`;

  await product.validateProductLoaded();
  await product.addToCart();
  await cart.validateProductInCart();
  await cart.proceedToCheckout();
  await guestLogin.checkoutAsGuest(`${inbox}@mailinator.com`);
  await checkout.fillCustomerData(testData.customer);
  await checkout.fillAddress(testData.address);
  await checkout.selectShippingMethod();
  await checkout.acceptTerms();
  await checkout.continueToPayment();
  await payment.selectCreditCard();
  await payment.fillCardData(testData.card);

  expect(new URL(page.url()).hostname).toBe("stg2.shop.samsung.com");
  await payment.placeOrder();

  const orderCode = await confirmation.validateOrderCreated();
  annotateQstExecution(testInfo, {
    type: process.env.QST_TYPE,
    storeType: "Base Store",
    orderNumber: orderCode,
  });
  testInfo.annotations.push({ type: "qst-order", description: orderCode });
});
