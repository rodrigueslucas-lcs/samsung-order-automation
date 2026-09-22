import fs from "node:fs";
import path from "node:path";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import MarketPaymentPage from "../../../../../pages/MarketPaymentPage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import mxTestCard from "../../../../../utils/mxTestCard.js";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const { requirePaymentSubmitOptIn } = destructiveGuards;
const { getMxTestCard } = mxTestCard;

test.describe.configure({ timeout: 1200000, retries: 0 });
const guestOrderRuntimeFile = path.resolve("test-results/mx-qst/latest-guest-order.json");

// Proven reusable guest prerequisite from the 2026-09-16 tracking diagnosis.
// Keep env/runtime overrides first; this fallback prevents SAM-25010 from
// unexpectedly creating another order just to exercise Track Order + OTP.
const provenTrackingPrerequisite = {
  orderNumber: "MX260915-63943192",
  email: "mx-qst-1789499434831@mailinator.com",
  inbox: "mx-qst-1789499434831",
};

function normalizeMxOrderCode(value) {
  return String(value || "").match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || null;
}

function readGuestOrderRuntime() {
  if (!fs.existsSync(guestOrderRuntimeFile)) return null;

  try {
    const value = JSON.parse(fs.readFileSync(guestOrderRuntimeFile, "utf8"));
    const orderNumber = normalizeMxOrderCode(value.orderNumber);
    const email = String(value.email || "").trim().toLowerCase();
    const inbox = String(value.inbox || "").trim();

    // A code observed during checkout/payment is not enough to prove that the
    // order is safe to reuse. Only consume runtime explicitly marked confirmed.
    const confirmed = value.confirmed === true || /confirmed|confirmation/i.test(String(value.status || value.outcome || ""));
    return confirmed && orderNumber && email && inbox
      ? { orderNumber, email, inbox }
      : null;
  } catch {
    return null;
  }
}

async function createFreshGuestOrder(page, mxConfig) {
  requirePaymentSubmitOptIn();
  const inbox = `mx-qst-${Date.now()}`;
  const email = `${inbox}@mailinator.com`;
  const { checkout } = await reachMxGuestPayment(page, mxConfig, email);
  if (mxConfig.environment === "S2") {
    const payment = new MarketPaymentPage(page, { market: "MX" });
    const card = getMxTestCard();
    const cardDigits = card.number.replace(/\D/g, "");
    const mastercardBin = Number(cardDigits.slice(0, 4));
    const isMastercard = cardDigits.length === 16 && (
      /^5[1-5]/.test(cardDigits) ||
      (mastercardBin >= 2221 && mastercardBin <= 2720)
    );
    if (!isMastercard) {
      throw new Error("MX S2 Track Order prerequisite requires the approved Mastercard test data in the ignored local card file.");
    }
    await payment.selectCreditCard();
    await payment.fillCardData(card);
    await payment.validateCreditCardReady(card);
    const result = await payment.placeOrderAndCapture();
    fs.mkdirSync(path.dirname(guestOrderRuntimeFile), { recursive: true });
    fs.writeFileSync(guestOrderRuntimeFile, JSON.stringify({
      orderNumber: result.orderCode,
      email,
      inbox,
      market: "mx",
      environment: mxConfig.environment,
      paymentMode: "mx-mercadoCC",
      confirmed: true,
      createdAt: new Date().toISOString(),
    }, null, 2));
    return { orderNumber: result.orderCode, email, inbox, fresh: true };
  }
  await checkout.selectPaymentMode(/^SPEI/i);

  let responseOrderCode = null;
  page.on("response", (response) => {
    if (!/order|payment|checkout|transaction/i.test(response.url())) return;
    response.text().then((body) => {
      responseOrderCode ||= normalizeMxOrderCode(body);
    }).catch(() => {});
  });

  const action = page.getByRole("button", { name: /^Continuar a Mercado Pago$/i });
  await expect(action).toBeEnabled({ timeout: 30000 });
  const initialUrl = page.url();
  const popupPromise = page.context().waitForEvent("page", { timeout: 120000 }).catch(() => null);
  await action.click(); // Submit exactly once; never retry an uncertain order creation.
  const outcome = await Promise.race([
    page.waitForURL((url) => url.href !== initialUrl, { timeout: 120000 }).then(() => page),
    popupPromise,
  ]);
  const target = outcome || page;
  await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  const body = await target.locator("body").innerText({ timeout: 30000 }).catch(() => "");
  const orderNumber = normalizeMxOrderCode(body) || responseOrderCode;
  if (!orderNumber) throw new Error("Guest order submit produced no observable order code; do not retry.");
  await expect(target.getByText(/confirmaci[oó]n|pedido recibido|gracias por tu compra/i).filter({ visible: true }).first())
    .toBeVisible({ timeout: 60000 });
  return { orderNumber, email, inbox, fresh: true };
}

test("SAM-25010 @destructive @qst @mx @base-store - Track Order with email and Order ID", async ({ page, context, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25010"));

  let orderNumber;
  let email;
  let inbox;
  if (process.env.MX_QST_TRACKING_CREATE_ORDER === "1") {
    ({ orderNumber, email, inbox } = await createFreshGuestOrder(page, mxConfig));
  } else {
    orderNumber = normalizeMxOrderCode(process.env.MX_QST_TRACKING_ORDER?.trim());
    email = process.env.MX_QST_TRACKING_EMAIL?.trim().toLowerCase();
    inbox = process.env.MAILINATOR_INBOX?.trim();
  }

  if (!orderNumber || !email || !inbox) {
    const causalOrder = readGuestOrderRuntime();
    if (causalOrder) ({ orderNumber, email, inbox } = causalOrder);
  }

  if (!orderNumber || !email || !inbox) {
    if (mxConfig.environment === "S2") {
      test.skip(true, "S2 Track Order requires a fresh causal order; set MX_QST_TRACKING_CREATE_ORDER=1 with the guarded test card configured.");
    }
    ({ orderNumber, email, inbox } = provenTrackingPrerequisite);
    testInfo.annotations.push({
      type: "guest-tracking-prerequisite",
      description: `Reused proven guest MX prerequisite order ${orderNumber} using ${email}; no checkout/payment was submitted.`,
    });
  }

  expect(email).toBe(`${inbox}@mailinator.com`.toLowerCase());
  expect(orderNumber).toMatch(/^MX/i);

  await page.goto(new URL("/mx/mypage/orders", mxConfig.baseUrl.origin).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const trackingPage = new GuestOrderTrackingPage(page, {
    market: "mx",
    currencyPattern: /\$\s*[\d,.]+/,
    productPattern: new RegExp(mxConfig.sku, "i"),
  });
  await trackingPage.validateGuestTrackingForm();

  const mailPage = await context.newPage();
  const mailinator = new MailinatorPage(mailPage, inbox);
  await mailinator.openInbox();
  const baselineMessageIds = await mailinator.snapshotMessageIds();

  await page.bringToFront();
  const otpRequest = await trackingPage.requestVerificationCode(orderNumber, email, {
    // S2 confirms checkout before the guest-order lookup index is necessarily
    // ready. Poll the observable OTP endpoint for the same causal order; never
    // resubmit checkout/payment while waiting for that index.
    maxAttempts: process.env.MX_QST_TRACKING_CREATE_ORDER === "1" ? 4 : 1,
    retryDelayMs: 15000,
  });

  await mailPage.bringToFront();
  // A previously delivered code can be invalidated by this new request.
  // Only consume the message arriving after it, never the first old inbox row.
  const otpEmail = await mailinator.waitForOtpEmail({ baselineMessageIds });

  await page.bringToFront();
  await trackingPage.submitVerificationCode(otpEmail.otp, orderNumber);
  const result = await trackingPage.validateTrackedOrder(orderNumber);

  expect(result.status).toBeTruthy();
  expect(result.hasOrderSummary).toBe(true);

  testInfo.annotations.push(
    {
      type: "guest-otp-request",
      description: `${otpRequest.method} ${otpRequest.status} ${otpRequest.endpoint}; accepted=${otpRequest.accepted}`,
    },
    {
      type: "guest-tracking-order",
      description: `${orderNumber}; status=${result.status}; product=${result.hasProduct}; summary=${result.hasOrderSummary}`,
    }
  );
});
