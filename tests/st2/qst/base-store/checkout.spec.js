import { test } from "@playwright/test";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import { testData } from "../../../../utils/testData";
import { annotateQstExecution } from "../../../../utils/qstExecutionSummary";

test("QST-BS-12 @qst @qst-normal @qst-modified @base-store - Enter delivery address", async ({ page }, testInfo) => {
  test.setTimeout(240000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });

  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const guestLogin = new GuestLoginPage(page);
  const checkout = new CheckoutPage(page);

  await product.validateProductLoaded();
  await product.addToCart();
  await cart.validateProductInCart();
  await cart.proceedToCheckout();
  await guestLogin.checkoutAsGuest(testData.customer.email);
  await checkout.fillCustomerData(testData.customer);
  await checkout.fillAddress(testData.address);
  await checkout.validateCheckoutAddressPage();
});
