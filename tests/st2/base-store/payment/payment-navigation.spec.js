import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import { testData } from "../../../../utils/testData";

test.describe("ST2 - Base Store - Payment Navigation", () => {
  test("TC61 - Customer able to navigate back to cart from Payment page using the Edit button", async ({ page }) => {
    test.setTimeout(300000);

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
    await checkoutPage.selectShippingMethod();
    await checkoutPage.acceptTerms();
    await checkoutPage.continueToPayment();

    await paymentPage.validatePaymentPage();
    await paymentPage.navigateBackToCart();

    await cartPage.validateProductInCart();
  });
});
