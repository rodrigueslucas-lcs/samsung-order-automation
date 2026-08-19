import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";

import { testData } from "../../../../utils/testData";

test.describe("ST2 - Base Store - Checkout Page", () => {

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


  test("TC36 - Customer able to see the Checkout Login button in the Checkout Address Page", async ({ page }) => {
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
    await checkoutPage.validateCheckoutLoginButton();
  });


  test("TC37 - Customer able to verify checkout page products added displays correctly in Summary details", async ({ page }) => {
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
    await checkoutPage.validateCheckoutProductSummary();
  });


  test("TC38 - Customer able to verify checkout page Tax is applied correctly and price break down is displayed properly", async ({ page }) => {
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
    await checkoutPage.validateCheckoutPriceBreakdown();
  });


  test("TC42 - Customer able to input any Phone Number", async ({ page }) => {
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

    await checkoutPage.validatePhoneNumberInput(testData.customer.phone);
  });


  test("TC43 - Customer able to input any Address", async ({ page }) => {
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

    await checkoutPage.validateAddressInput(testData.address.street);
  });


  test("TC44 - Customer able to input any Address line 2 Optional", async ({ page }) => {
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

    await checkoutPage.validateAddressLine2Input("Apto 101");
  });


  test("TC45 - Customer able to input any City", async ({ page }) => {
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

    await checkoutPage.validateCityInput(testData.address);
  });

  test("TC46 - Customer able to input any Province", async ({ page }) => {
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

    await checkoutPage.validateProvinceInput(testData.address);
  });

  test("TC47 - Customer able to input any Postal Code", async () => {
    test.skip(
      true,
      "TC47 is not applicable to ST2 Peru: Delivery and Billing do not expose a Postal Code field."
    );
  });


});
