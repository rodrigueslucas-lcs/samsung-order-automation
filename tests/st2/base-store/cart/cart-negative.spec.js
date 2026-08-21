import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";

import CartPage from "../../../../pages/CartPage";

test.describe("ST2 - Base Store - Cart Negative Validations", () => {



  test("Cart - quantity cannot decrease below one", async ({ page }) => {

    test.setTimeout(180000);

    const productPage = new ProductPage(page);

    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();

    await productPage.addToCart();

    await cartPage.validateProductInCart();

    await cartPage.validateQuantityLowerBoundary();

  });


 test("Cart - invalid coupon is rejected", async ({ page }) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCart();
   await cartPage.openCart();
   await cartPage.validateCartPage();
   await cartPage.validateProductInCart();
   await cartPage.validateInvalidCoupon();
 });
});

