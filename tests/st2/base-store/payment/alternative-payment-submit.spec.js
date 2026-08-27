import { test } from "@playwright/test";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import { testData } from "../../../../utils/testData";

const paymentModes = {
  banca: { code: "pe-Bancapor", select: "selectBancaPorInternet" },
  efectivo: { code: "pe-pagoEfectivo", select: "selectPagoEfectivo" },
  cuotealo: { code: "pe-Cuotealo", select: "selectCuotealo" },
  acuotaz: { code: "Acuotaz", select: "selectAcuotaz" },
};

test("Alternative payment submit probe", async ({ page }) => {
  test.setTimeout(360000);
  const modeName = process.env.STOREFRONT_PAYMENT_MODE?.toLowerCase();
  const mode = paymentModes[modeName];
  test.skip(!mode, "Set STOREFRONT_PAYMENT_MODE to an approved payment mode.");

  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);
  const guestLoginPage = new GuestLoginPage(page);
  const checkoutPage = new CheckoutPage(page);
  const paymentPage = new PaymentPage(page);
  const paymentApi = [];

  page.on("response", async (response) => {
    if (!/payment/i.test(response.url()) || response.status() >= 400) return;
    const text = await response.text().catch(() => "");
    if (text.includes(mode.code)) {
      paymentApi.push({
        status: response.status(),
        endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
      });
    }
  });

  await productPage.validateProductLoaded();
  await productPage.addToCart();
  await cartPage.validateProductInCart();
  await cartPage.proceedToCheckout();
  await guestLoginPage.checkoutAsGuest(testData.customer.email);
  await checkoutPage.fillCustomerData(testData.customer);
  await checkoutPage.fillAddress(testData.address);
  await checkoutPage.selectShippingMethod();
  await checkoutPage.acceptTerms();
  await checkoutPage.continueToPayment();
  await paymentPage.validatePaymentPage();
  await paymentPage[mode.select]();

  const result = await paymentPage.submitSelectedPaymentMode();
  test.info().annotations.push({
    type: "payment-submit-result",
    description: JSON.stringify({ mode: modeName, code: mode.code, paymentApi, ...result }),
  });
  console.log(`PAYMENT_RESULT ${JSON.stringify({ mode: modeName, code: mode.code, paymentApi, ...result })}`);
});
