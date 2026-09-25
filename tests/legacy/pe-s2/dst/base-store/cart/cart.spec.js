import { test, expect } from "@playwright/test";

import ProductPage from "../../../../../../pages/ProductPage";
import CartPage from "../../../../../../pages/CartPage";

test.describe("ST2 - Base Store - Cart Page", () => {

  test("TC17 - Customer able to increase and decrease the quantity (or remove products)", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();

    await cartPage.validateQuantityCanChange();
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
   await productPage.addToCartForAdditionalServices();
   await cartPage.validateProductInCart();
   await cartPage.validateExternalServicesVisible();
 });

 test("TC19 partial - Added Services and Recommended Products", async ({ page }, testInfo) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();
   await productPage.addToCartForAdditionalServices();
   const result = await cartPage.inspectAddedServicesAndRecommendedProducts();

   if (!result.recommendationVisible) {
     testInfo.annotations.push({
       type: "partial",
       description: "Additional Services is available; no Recommended Products section is rendered by current ST2 data.",
     });
   }
 });


  test("TC28 - Customer able to click the Samsung Care Plus Button", async ({ page }) => {

    test.setTimeout(180000);

    const productPage = new ProductPage(page);

    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();

    await productPage.addToCartForAdditionalServices();

    await cartPage.validateProductInCart();

    await cartPage.addFunctionalAdditionalService({
      acceptTerms: false,
      submit: false,
    });

  });


 test("TC29 - Customer able to navigate on Pop-up Customer Journey in adding Samsung Care Plus.", async ({ page }) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCartForAdditionalServices();
   await cartPage.validateProductInCart();
   await cartPage.addFunctionalAdditionalService({ submit: false });
 });

 test("TC23 - Customer able to click the Trade-in button", async ({ page }) => {

   test.setTimeout(180000);

   const productPage = new ProductPage(page);

   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();

   await productPage.addToCartForAdditionalServices();

   await cartPage.openTradeInJourney();

 });

 test("TC24 - Customer able to navigate Trade-in customer journey", async ({ page }) => {
   test.setTimeout(240000);

   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();
   await productPage.addToCartForAdditionalServices();

   await cartPage.openTradeInJourney();
   await cartPage.completeTradeInJourney();
   await cartPage.validateTradeInAdded();
 });

 test("TC25 - Customer able to see the trade-in amount on the last pop-up", async ({ page }) => {
   test.setTimeout(240000);

   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();
   await productPage.addToCartForAdditionalServices();

   await cartPage.openTradeInJourney();
   await cartPage.completeTradeInJourney();
 });

 test("TC26 - Customer able to successfully add Trade-in in the cart page", async ({ page }) => {
   test.setTimeout(240000);

   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();
   await productPage.addToCartForAdditionalServices();

   await cartPage.openTradeInJourney();
   await cartPage.completeTradeInJourney();
   await cartPage.validateTradeInAdded();
 });

 test("TC27 - Customer able to see the Trade-in amount in the summary", async ({ page }) => {
   test.setTimeout(240000);

   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();
   await productPage.addToCartForAdditionalServices();

   await cartPage.openTradeInJourney();
   await cartPage.completeTradeInJourney();
   await cartPage.validateTradeInAdded();
   await cartPage.validateTradeInSummaryAmount();
 });

 test("TC30 - Customer able to successfully add Samsung Care Plus in the cart page", async ({ page }) => {

   test.setTimeout(180000);

   const productPage = new ProductPage(page);

   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();

   await productPage.addToCartForAdditionalServices();

   await cartPage.addFunctionalAdditionalService();

   await cartPage.validateAddedAdditionalService();

 });

 test("TC31 - Customer able to see the Samsung Care Plus amount in the summary", async ({ page }) => {

   test.setTimeout(180000);

   const productPage = new ProductPage(page);

   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();

   await productPage.addToCartForAdditionalServices();

   await cartPage.addFunctionalAdditionalService();

   await cartPage.validateAddedAdditionalService();

   const summary = page

     .getByRole("heading", { name: /Resumen de la orden/i })

     .locator("..");

   await summary

     .getByText(/SC\+.*Mantenimiento preventivo.*French Door.*2 años/i)

     .waitFor({ state: "visible", timeout: 30000 });

   await summary

     .getByText("S/ 389.00", { exact: true })

     .waitFor({ state: "visible", timeout: 30000 });

 });

 test("TC32 - Total price changes after Samsung Care Plus is applied", async ({ page }) => {

   test.setTimeout(180000);

   const productPage = new ProductPage(page);

   const cartPage = new CartPage(page);

   await productPage.validateProductLoaded();

   await productPage.addToCartForAdditionalServices();

   const totalBefore = await cartPage.readCartTotal();

   await cartPage.addFunctionalAdditionalService();

   await cartPage.validateAddedAdditionalService();

   const totalAfter = await cartPage.readCartTotal();

   if (totalAfter <= totalBefore) {

     throw new Error(

       `Cart total did not increase after adding Samsung Care+. Before: ${totalBefore}, After: ${totalAfter}`

     );

   }

   const expectedDifference = 389;

   if (Math.abs((totalAfter - totalBefore) - expectedDifference) > 0.01) {

     throw new Error(

       `Unexpected Samsung Care+ total difference. Before: ${totalBefore}, After: ${totalAfter}`

     );

   }

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
