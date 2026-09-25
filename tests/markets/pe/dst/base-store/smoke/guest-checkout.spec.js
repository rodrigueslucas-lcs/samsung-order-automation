import { test, expect } from "@playwright/test";

import ProductPage from "../../../../../../pages/ProductPage";
import GuestLoginPage from "../../../../../../pages/GuestLoginPage";
import CartPage from "../../../../../../pages/CartPage";
import CheckoutPage from "../../../../../../pages/CheckoutPage";
import PaymentPage from "../../../../../../pages/PaymentPage";
import OrderConfirmationPage from "../../../../../../pages/OrderConfirmationPage";
import MailinatorPage from "../../../../../../pages/MailinatorPage";

import { testData } from "../../../../../../utils/testData";

const VALIDATE_ORDER_EMAIL = process.env.VALIDATE_ORDER_EMAIL === "1";

function buildMailinatorIdentity() {
  const runtimeInbox = process.env.MAILINATOR_INBOX?.trim();
  const runtimeEmail = process.env.STOREFRONT_GUEST_EMAIL?.trim().toLowerCase();
  const generatedInbox = `s2tc63-${new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "")}-${Math.random().toString(36).slice(2, 5)}`;
  const inboxFromEmail = runtimeEmail?.match(/^([^@]+)@mailinator\.com$/i)?.[1];

  if (runtimeEmail && !inboxFromEmail) {
    throw new Error("STOREFRONT_GUEST_EMAIL must use @mailinator.com for TC63.");
  }
  if (runtimeInbox && inboxFromEmail && runtimeInbox.toLowerCase() !== inboxFromEmail.toLowerCase()) {
    throw new Error("MAILINATOR_INBOX and STOREFRONT_GUEST_EMAIL identify different inboxes.");
  }

  const inbox = runtimeInbox || inboxFromEmail || generatedInbox;
  if (!/^[a-z0-9][a-z0-9._-]{2,26}$/i.test(inbox)) {
    throw new Error(`Invalid or overly long Mailinator inbox: ${inbox}`);
  }
  const email = runtimeEmail || `${inbox}@mailinator.com`;
  if (email.length > 40) {
    throw new Error(`ST2 guest email exceeds the 40-character limit: ${email.length}`);
  }
  return { inbox, email };
}

test.describe("ST2 - Base Store - Guest Customer Order Journey", () => {

  test("TC63 - Mailinator UI preflight", async ({ page }) => {
    test.skip(!VALIDATE_ORDER_EMAIL, "Set VALIDATE_ORDER_EMAIL=1 for Mailinator UI validation.");
    const { inbox } = buildMailinatorIdentity();
    const mailinator = new MailinatorPage(page, inbox);
    await mailinator.openInbox();
    await expect(page.getByRole("heading", { name: "Public Messages" })).toBeVisible();
  });

  test("@destructive E2E - Guest checkout using Credit Card with optional TC63 email validation", async ({ page, context }, testInfo) => {
    test.skip(
      process.env.ALLOW_PAYMENT_SUBMIT !== "1",
      "Set ALLOW_PAYMENT_SUBMIT=1 to authorize the single Place Order submit."
    );
    test.setTimeout(1200000);

    const mailIdentity = VALIDATE_ORDER_EMAIL ? buildMailinatorIdentity() : null;
    const guestEmail = mailIdentity?.email || testData.customer.email;

    const productPage = new ProductPage(page);
    const guestLoginPage = new GuestLoginPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const paymentPage = new PaymentPage(page);
    const orderConfirmationPage = new OrderConfirmationPage(page);

    await test.step("TC15/TC16 - Cart Page and added product displayed correctly", async () => {
      await productPage.validateProductLoaded();
      await productPage.addToCart();

      await cartPage.validateProductInCart();
    });

    await test.step("TC20/TC33 - Checkout button and navigation to Checkout", async () => {
      await cartPage.proceedToCheckout();
    });

    await test.step("TC34 - Checkout Login Page", async () => {
      await guestLoginPage.checkoutAsGuest(guestEmail);
    });

    await test.step("TC35/TC42-TC47 - Checkout Address Page and customer address data", async () => {
      await checkoutPage.fillCustomerData(testData.customer);
      await checkoutPage.fillAddress(testData.address);
    });

    await test.step("TC49/TC50 - Available delivery mode and delivery selection", async () => {
      await checkoutPage.selectShippingMethod();
    });

    await test.step("TC53 - Navigate to Payment Page", async () => {
      await checkoutPage.acceptTerms();
      await checkoutPage.continueToPayment();
    });

    await test.step("TC54/TC57 - Payment Page and Credit Card payment mode", async () => {
      await paymentPage.selectCreditCard();
      await paymentPage.fillCardData(testData.card);
    });

    await test.step("TC58/TC77 - Complete order using Credit Card", async () => {
      await paymentPage.placeOrder();
    });

    let orderCode;
    await test.step("TC62 - Order Confirmation Page displayed", async () => {
      orderCode = await orderConfirmationPage.validateOrderCreated();
    });

    if (VALIDATE_ORDER_EMAIL) {
      await test.step("TC63 - Order email received and correlated through Mailinator UI", async () => {
        const mailPage = await context.newPage();
        const mailinator = new MailinatorPage(mailPage, mailIdentity.inbox);
        await mailinator.openInbox();
        const result = await mailinator.waitForOrderEmail(orderCode);
        expect(result.sender).toMatch(/customerservice@shopmail\.samsung\.com|Customer Services Team/i);
        expect(result.subject).toMatch(/\u00a1Recibimos tu pedido!|\u00a1Pago confirmado!/i);
        expect(result.bodyText).toContain(orderCode);
        testInfo.annotations.push(
          { type: "tc63-inbox", description: mailIdentity.inbox },
          { type: "tc63-order", description: orderCode },
          { type: "tc63-subject", description: result.subject },
          { type: "tc63-elapsed-ms", description: String(result.elapsedMs) },
        );
      });
    }
  });

  test("@destructive TC59 - IM order with Trade-in and Samsung Care+", async ({ page }) => {
    test.skip(
      true,
      "TC59 is on stand-by: ST2 removes Samsung Care+ at Checkout because the service is unavailable/out of stock."
    );
    test.setTimeout(420000);

    const productPage = new ProductPage(page);
    const guestLoginPage = new GuestLoginPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const paymentPage = new PaymentPage(page);
    const orderConfirmationPage = new OrderConfirmationPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCartForAdditionalServices();
    await cartPage.openTradeInJourney();
    await cartPage.completeTradeInJourney();
    await cartPage.validateTradeInAdded();
    await cartPage.addFunctionalAdditionalService();
    await cartPage.validateAddedAdditionalService();

    await cartPage.proceedToCheckout();
    await guestLoginPage.checkoutAsGuest(testData.customer.email);
    await checkoutPage.fillCustomerData(testData.customer);
    await checkoutPage.fillAddress(testData.address);
    await checkoutPage.selectShippingMethod();
    await checkoutPage.acceptTerms();
    await checkoutPage.continueToPayment();
    await paymentPage.selectCreditCard();
    await paymentPage.fillCardData(testData.card);
    await paymentPage.placeOrder();
    await orderConfirmationPage.validateOrderCreated();
  });

});
