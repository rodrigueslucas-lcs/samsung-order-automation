import { test } from "@playwright/test";

import ProductPage from "../../../pages/ProductPage";
import CartPage from "../../../pages/CartPage";
import GuestLoginPage from "../../../pages/GuestLoginPage";
import CheckoutPage from "../../../pages/CheckoutPage";

import { testData } from "../../../utils/testData";

test.describe("ST2 - Checkout Page", () => {

  test("TC34 - Customer able to see Checkout Login Page", async ({ page }) => {
    test.setTimeout(150000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    const guestLoginPage = new GuestLoginPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();
    await cartPage.proceedToCheckout();

    await guestLoginPage.validateCheckoutLoginPage();
  });


  test("TC35 - Customer able to see the Checkout Address Page", async ({ page }) => {
    test.setTimeout(180000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    const guestLoginPage = new GuestLoginPage(page);
    const checkoutPage = new CheckoutPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();
    await cartPage.proceedToCheckout();

    await guestLoginPage.checkoutAsGuest(testData.customer.email);

    await checkoutPage.fillCustomerData(testData.customer);

    await checkoutPage.validateCheckoutAddressPage();
  });

});
