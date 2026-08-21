import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import authState from "../../../../utils/authState";
import { testData } from "../../../../utils/testData";

const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  requireAuthState,
  validateAuthenticatedSession,
} = authState;

test.use({ channel: "chrome" });

test.describe("ST2 - Base Store - Authenticated Checkout", () => {
  test.use({ storageState: requireAuthState() || AUTH_STATE_PATH });

  test.beforeEach(async ({ context }) => {
    await applyAuthSessionStorage(context);
  });

  test("Authenticated checkout reaches Payment without saving the new address", async ({ page }) => {
    test.setTimeout(240000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const paymentPage = new PaymentPage(page);

    await validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const addToCartResponse = await page.goto(productPage.addToCartUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    if (!addToCartResponse || addToCartResponse.status() >= 400) {
      throw new Error(
        `Authenticated add-to-cart failed with status ${addToCartResponse?.status() ?? "no response"}`
      );
    }

    const accessResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/users/current/checkAccess") &&
        response.status() === 200,
      { timeout: 60000 }
    );
    await page.goto(productPage.cartUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await accessResponsePromise;

    await cartPage.validateProductInCart();

    await cartPage.proceedToAuthenticatedCheckout();
    await checkoutPage.fillCustomerData(testData.customer);
    await checkoutPage.validateAuthenticatedDeliveryForm();
    await checkoutPage.fillAddress(testData.address);
    await checkoutPage.validateAddressValues(testData.address);
    await checkoutPage.selectShippingMethod();
    await checkoutPage.acceptTerms();
    await checkoutPage.continueToPayment();
    await paymentPage.validatePaymentPage();
  });
});
