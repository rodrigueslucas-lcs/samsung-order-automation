import { test } from "@playwright/test";

import ProductPage from "../../../../../../pages/ProductPage";
import CartPage from "../../../../../../pages/CartPage";
import CheckoutPage from "../../../../../../pages/CheckoutPage";
import PaymentPage from "../../../../../../pages/PaymentPage";
import authState from "../../../../../../utils/authState";
import { testData } from "../../../../../../utils/testData";

const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  validateAuthenticatedSession,
} = authState;
const AUTH_REQUIRED = "Authenticated storefront state required. Run auth bootstrap first.";

test.use({ channel: "chrome" });

async function reachAuthenticatedDelivery(page) {
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

  return { checkoutPage, paymentPage };
}

async function reachAuthenticatedPaymentWithSavedAddress(page) {
  const { checkoutPage, paymentPage } = await reachAuthenticatedDelivery(page);
  await checkoutPage.selectSavedAddressAndValidate();
  await checkoutPage.selectShippingMethod();
  await checkoutPage.acceptTerms();
  await checkoutPage.continueToPayment();
  await paymentPage.validatePaymentPage();

  return paymentPage;
}

test.describe("ST2 - Base Store - Authenticated Checkout", () => {
  test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!hasAuthState(), AUTH_REQUIRED);
    await applyAuthSessionStorage(context);
  });

  test("Authenticated checkout reaches Payment without saving the new address", async ({ page }) => {
    test.setTimeout(240000);

    const { checkoutPage, paymentPage } = await reachAuthenticatedDelivery(page);
    await checkoutPage.validateAuthenticatedDeliveryForm();
    await checkoutPage.fillAddress(testData.address);
    await checkoutPage.validateAddressValues(testData.address);
    await checkoutPage.selectShippingMethod();
    await checkoutPage.acceptTerms();
    await checkoutPage.continueToPayment();
    await paymentPage.validatePaymentPage();
  });

  test("TC39 - Customer able to used save address in checking out.", async ({ page }) => {
    test.setTimeout(240000);

    await reachAuthenticatedPaymentWithSavedAddress(page);
  });

  test("TC78 pre-submit - Customer able to select Banca por Internet payment mode", async ({ page }) => {
    test.setTimeout(240000);

    const paymentPage = await reachAuthenticatedPaymentWithSavedAddress(page);
    await paymentPage.selectBancaPorInternet();
  });

  test("TC79 pre-submit - Customer able to select Pago Efectivo payment mode", async ({ page }) => {
    test.setTimeout(240000);

    const paymentPage = await reachAuthenticatedPaymentWithSavedAddress(page);
    await paymentPage.selectPagoEfectivo();
  });

  test("TC80 pre-submit - Customer able to select Cuotéalo payment mode", async ({ page }) => {
    test.setTimeout(240000);

    const paymentPage = await reachAuthenticatedPaymentWithSavedAddress(page);
    await paymentPage.selectCuotealo();
  });

  test("TC77 pre-submit - Customer able to complete Credit Card data", async ({ page }) => {
    test.setTimeout(300000);

    const paymentPage = await reachAuthenticatedPaymentWithSavedAddress(page);
    await paymentPage.selectCreditCard();
    await paymentPage.fillCardData(testData.card);
    await paymentPage.validateCreditCardReady(testData.card);
  });
});
