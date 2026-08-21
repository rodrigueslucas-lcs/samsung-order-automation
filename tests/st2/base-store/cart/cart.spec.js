import { test, expect } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";

test.describe("ST2 - Base Store - Cart Page", () => {

  test("TC17 - Customer able to increase and decrease the quantity (or remove products)", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();

    const quantity = page.getByRole("textbox", { name: "Quantity" });
    const plusButton = page.getByRole("button", { name: "+" });
    const minusButton = page.getByRole("button", { name: "-" });

    await expect(quantity).toHaveValue("1");

    await plusButton.click();

    await expect(quantity).toHaveValue("2", {
      timeout: 30000,
    });

    await minusButton.click();

    await expect(quantity).toHaveValue("1", {
      timeout: 30000,
    });
  });


  test("TC18 - Customer able to see order summary is displayed correctly on right side (without taxes)", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();

    const summary = await cartPage.validateOrderSummary();

    expect(summary.subtotal).toBeTruthy();
    expect(summary.total).toBeTruthy();
    expect(summary.total).toBe(summary.subtotal);
  });


  test("TC20 - Customer able to see Checkout Button", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();
    await cartPage.validateCheckoutButton();
  });


  test("TC15 - Customer able to see the Cart Page", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateCartPage();
  });

  test("TC16 - Customer able to verify cart page (Products added displays correctly)", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();
  });

  test("TC33 - Customer able to navigate to Checkout Page, when click the Checkout Button", async ({ page }) => {
    test.setTimeout(150000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();
    await cartPage.proceedToCheckout();

    await page
      .getByPlaceholder(/ingresa tu correo/i)
      .waitFor({
        state: "visible",
        timeout: 30000
      });
  });



  test("TC22 - Customer able to see the Footer for Cart Page", async ({ page }) => {

    test.setTimeout(180000);

    const productPage = new ProductPage(page);

    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();

    await productPage.addToCart();

    await cartPage.validateProductInCart();

    await cartPage.validateCartFooter();

  });


 test("TC21 - Customer able to see external services such Trade-in or Samsung Care Plus.", async ({ page }) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCart();
   await cartPage.validateProductInCart();
   await cartPage.validateExternalServicesVisible();
 });


  test("TC28 - Customer able to click the Samsung Care Plus Button", async ({ page }) => {

    test.setTimeout(180000);

    const productPage = new ProductPage(page);

    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();

    await productPage.addToCart();

    await cartPage.validateProductInCart();

    await cartPage.validateSamsungCareButton();

  });


 test("TC29 - Customer able to navigate on Pop-up Customer Journey in adding Samsung Care Plus.", async ({ page }) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCart();
   await cartPage.validateProductInCart();
   await cartPage.validateSamsungCareJourney();
 });

 test("Cart - available payment methods are displayed", async ({ page }) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCart();
   await cartPage.openCart();
   await cartPage.validateCartPage();
   await cartPage.validateProductInCart();
   await cartPage.validateCartPaymentMethods();
 });
});
