import { test } from "@playwright/test";
import ProductPage from "../../../../pages/ProductPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CartPage from "../../../../pages/CartPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import { testData } from "../../../../utils/testData";
test.describe("ST2 - Base Store - Mobile Order Journey", () => {
 test.use({
   viewport: {
     width: 390,
     height: 844,
   },
 });
 test("TC83 pre-submit - Customer able to checkout using mobile browser", async ({ page }) => {
   test.setTimeout(300000);
   const productPage = new ProductPage(page);
   const guestLoginPage = new GuestLoginPage(page);
   const cartPage = new CartPage(page);
   const checkoutPage = new CheckoutPage(page);
   const paymentPage = new PaymentPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCart();
   await cartPage.validateProductInCart();
   await cartPage.proceedToCheckout();
   await guestLoginPage.checkoutAsGuest(testData.customer.email);
   await checkoutPage.fillCustomerData(testData.customer);
   await checkoutPage.fillAddress(testData.address);
   await checkoutPage.selectShippingMethod();
   await checkoutPage.acceptTerms();
   await checkoutPage.continueToPayment();
   await paymentPage.validatePaymentPage();
   await paymentPage.selectCreditCard();
   await paymentPage.fillCardData(testData.card);
   await paymentPage.validateCreditCardReady(testData.card);
   // Intentionally stop before Place Order.
 });
});
