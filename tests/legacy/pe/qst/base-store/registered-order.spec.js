import { test, expect } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import CheckoutPage from "../../../../../pages/CheckoutPage";
import PaymentPage from "../../../../../pages/PaymentPage";
import MyOrdersPage from "../../../../../pages/MyOrdersPage";
import ProfilePage from "../../../../../pages/ProfilePage";
import authState from "../../../../../utils/authState";
import { testData } from "../../../../../utils/testData";
import { annotateQstExecution } from "../../../../../utils/qstExecutionSummary";

const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  validateAuthenticatedSession,
} = authState;

test.describe("QST Base Store - registered order", () => {
  test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!hasAuthState(), "Authenticated ST2 state required. Run auth bootstrap first.");
    await applyAuthSessionStorage(context);
  });

  test("@destructive QST-BS-16 @qst @qst-normal @qst-sanity @base-store - Registered order with a different payment mode", async ({ page }, testInfo) => {
    test.skip(
      process.env.ALLOW_PAYMENT_SUBMIT !== "1",
      "Set ALLOW_PAYMENT_SUBMIT=1 to authorize exactly one ST2 payment submit."
    );
    test.setTimeout(1200000);
    annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });

    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);
    const payment = new PaymentPage(page);
    const myOrders = new MyOrdersPage(page);
    const profile = new ProfilePage(page);
    const qaAddress = profile.qaAddress("QST REGISTERED ORDER", testData.address);
    let qaAddressCreated = false;

    await validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");
    await myOrders.openMyOrders();
    const previousOrderCodes = await myOrders.visibleOrderCodes();

    await page.goto(product.addToCartUrl, { waitUntil: "domcontentloaded" });
    await page.goto(product.cartUrl, { waitUntil: "domcontentloaded" });
    await cart.validateProductInCart();
    await cart.proceedToAuthenticatedCheckout();
    await checkout.fillCustomerData(testData.customer);
    const savedAddress = page.getByRole("radio", {
      name: "Dirección guardada",
      exact: true,
    });
    if (await savedAddress.isVisible()) {
      await checkout.selectSavedAddressAndValidate();
    } else {
      await checkout.saveNewAuthenticatedAddress(qaAddress);
      qaAddressCreated = true;
    }

    try {
      await checkout.selectShippingMethod();
      await checkout.acceptTerms();
      await checkout.continueToPayment({ expectedPaymentMode: /^Pago Efectivo\b/i });
      await payment.validatePaymentPage({ expectedPaymentMode: /^Pago Efectivo\b/i });
      await payment.selectPagoEfectivo();

      expect(new URL(page.url()).hostname).toBe("stg2.shop.samsung.com");
      const submitResult = await payment.submitSelectedPaymentMode();
      testInfo.annotations.push({
        type: "payment-submit-result",
        description: JSON.stringify(submitResult),
      });

      await myOrders.openMyOrders();
      const created = await myOrders.waitForNewOrder(previousOrderCodes);
      const order = await myOrders.visibleOrderCode(created.orderCode);
      expect(order).toBeTruthy();
      annotateQstExecution(testInfo, {
        type: process.env.QST_TYPE,
        storeType: "Base Store",
        orderNumber: created.orderCode,
      });
      testInfo.annotations.push({
        type: "qst-order",
        description: `${created.orderCode}; indexedAfterMs=${created.elapsedMs}`,
      });
    } finally {
      if (qaAddressCreated) {
        await validateAuthenticatedSession(page).catch(() => {});
        await profile.deleteQaAddressesViaApi(qaAddress.street).catch((error) => {
          testInfo.annotations.push({
            type: "qa-cleanup-error",
            description: error.message,
          });
        });
      }
    }
  });
});
