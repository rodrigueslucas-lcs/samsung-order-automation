import { test } from "@playwright/test";
import ProductPage from "../../../../../../pages/ProductPage";
import CartPage from "../../../../../../pages/CartPage";
import GuestLoginPage from "../../../../../../pages/GuestLoginPage";
test.describe("ST2 - Base Store - Guest Login", () => {

 test("Guest checkout - invalid email validation", async ({ page }) => {
   test.setTimeout(180000);
   const productPage = new ProductPage(page);
   const cartPage = new CartPage(page);
   const guestLoginPage = new GuestLoginPage(page);
   await productPage.validateProductLoaded();
   await productPage.addToCart();
   await cartPage.validateProductInCart();
   await cartPage.proceedToCheckout();
   await guestLoginPage.validateInvalidGuestEmail();
 });
});
