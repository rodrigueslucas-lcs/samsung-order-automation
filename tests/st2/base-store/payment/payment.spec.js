import { test } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import GuestLoginPage from "../../../../pages/GuestLoginPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import PaymentPage from "../../../../pages/PaymentPage";
import { testData } from "../../../../utils/testData";

async function reachPayment(page) {
  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);
  const guestLoginPage = new GuestLoginPage(page);
  const checkoutPage = new CheckoutPage(page);
  const paymentPage = new PaymentPage(page);

  await productPage.validateProductLoaded();
  await productPage.addToCart();

  await cartPage.validateProductInCart();
  await cartPage.proceedToCheckout();

  await guestLoginPage.checkoutAsGuest(testData.customer.email);

  await checkoutPage.fillCustomerData(testData.customer);
  await checkoutPage.fillAddress(testData.address);

  // BASELINE FUNCIONAL DO CHECKOUT.
  // NÃO ALTERAR ESSA LÓGICA NOS TESTES DE PAYMENT.
  await checkoutPage.selectShippingMethod();
  await checkoutPage.acceptTerms();
  await checkoutPage.continueToPayment();

  return paymentPage;
}

test.describe("ST2 - Base Store - Payment Page", () => {
  test.describe.configure({ mode: "serial" });

  let context;
  let sharedPage;
  let paymentPage;
  let paymentModesApi = { observed: false, hasYape: false, status: null, endpoint: null };

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300000);

    // Faz o checkout UMA ÚNICA VEZ para todo o bloco de Payment.
    context = await browser.newContext();
    sharedPage = await context.newPage();

    sharedPage.on("response", async (response) => {
      if (!/\/paymentmodes$/i.test(new URL(response.url()).pathname)) return;
      const text = await response.text().catch(() => "");
      paymentModesApi = {
        observed: true,
        hasYape: text.includes("pe-yape"),
        status: response.status(),
        endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
      };
    });

    paymentPage = await reachPayment(sharedPage);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("TC53 - Customer able to navigate to Payment Page, when click the BuyNow Button", async () => {
    test.setTimeout(120000);

    await paymentPage.validatePaymentPage();
  });

  test("TC54 - Customer able to see Payment Page", async () => {
    test.setTimeout(120000);

    await paymentPage.validatePaymentPage();
  });

  test("TC55 - Customer able to see the price break down", async () => {
    test.setTimeout(120000);

    await paymentPage.validatePriceBreakdown();
  });

  test("TC56 - Customer able to see the address for Shipping and Billing", async () => {
    test.setTimeout(120000);

    await paymentPage.validateShippingAndBillingAddress(testData.address);
  });

  test("TC57 - Customer able to see all available Payment mode", async () => {
    test.setTimeout(120000);

    await paymentPage.validateAvailablePaymentModes();
  });

  test("TC78 pre-submit - Banca por Internet is selectable", async () => {
    test.setTimeout(120000);
    await paymentPage.selectBancaPorInternet();
  });

  test("TC79 pre-submit - Pago Efectivo is selectable", async () => {
    test.setTimeout(120000);
    await paymentPage.selectPagoEfectivo();
  });

  test("TC80 pre-submit - Cuotéalo is selectable", async () => {
    test.setTimeout(120000);
    await paymentPage.selectCuotealo();
  });

  test("TC81 discovery - Yape availability", async () => {
    test.setTimeout(120000);
    const names = await paymentPage.availablePaymentModeNames();
    test.info().annotations.push({
      type: "payment-modes",
      description: `${names.join(" | ")}; API=${JSON.stringify(paymentModesApi)}`,
    });
    test.skip(
      !(await paymentPage.isPaymentModeAvailable(/^Yape\b/i)),
      `Yape is not available for the current guest cart: ${names.join(" | ")}`
    );
    await paymentPage.selectYape();
  });

  test("TC82 discovery - Acuotaz availability", async () => {
    test.setTimeout(120000);
    const names = await paymentPage.availablePaymentModeNames();
    test.info().annotations.push({
      type: "payment-modes",
      description: names.join(" | "),
    });
    await paymentPage.selectAcuotaz();
  });

  test("@destructive TC58 - Customer able to complete order using one payment mode", async () => {
    test.skip(
      process.env.ALLOW_PAYMENT_SUBMIT !== "1",
      "Set ALLOW_PAYMENT_SUBMIT=1 to authorize the single Place Order submit."
    );
    test.setTimeout(300000);

    await paymentPage.selectCreditCard();
    await paymentPage.fillCardData(testData.card);
    await paymentPage.placeOrder();
  });
});
