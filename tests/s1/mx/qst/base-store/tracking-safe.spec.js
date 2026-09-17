import { test, expect } from "./mxQst.fixture";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { normalizeMxOrderCode, readGuestOrderRuntime, writeGuestOrderRuntime } from "../../../../../utils/mxGuestOrderRuntime.js";
import { createMxGuestOrder } from "../../../../../utils/mxGuestOrder.js";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

async function createGuestOrderForTracking(page, mxConfig) {
  const runtime = await createMxGuestOrder(page, mxConfig, {
    purpose: "SAM-25010",
    allowSubmit: process.env.ALLOW_PAYMENT_SUBMIT === "1",
  });
  writeGuestOrderRuntime(runtime);
  return runtime;
}

test.describe.configure({ timeout: 900000 });

test("SAM-25010 @destructive @qst @mx @base-store - Track Order with email and Order ID", async ({ page, context, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25010"));

  // Running SAM-25010 explicitly authorizes creation of at most one guest MX
  // prerequisite order when runtime overrides were not supplied.
  let orderNumber = normalizeMxOrderCode(process.env.MX_QST_TRACKING_ORDER?.trim());
  let email = process.env.MX_QST_TRACKING_EMAIL?.trim().toLowerCase();
  let inbox = process.env.MAILINATOR_INBOX?.trim();

  if (!orderNumber || !email || !inbox) {
    const causalOrder = readGuestOrderRuntime();
    if (causalOrder && !causalOrder.confirmed) {
      throw new Error(`A previous MX guest order candidate ${causalOrder.orderNumber} has not been confirmed. Verify it before tracking; do not create or resubmit another order.`);
    }
    if (causalOrder) ({ orderNumber, email, inbox } = causalOrder);
  }

  if (!orderNumber || !email || !inbox) {
    ({ orderNumber, email, inbox } = await createGuestOrderForTracking(page, mxConfig));
    testInfo.annotations.push({
      type: "guest-tracking-prerequisite",
      description: `Created one guest MX prerequisite order ${orderNumber} using ${email}.`,
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

  // This inbox is the exact causal inbox for the tracked order. Snapshot only
  // its current message ids before requesting the OTP. Reading historical OTP
  // bodies here is unnecessary and can churn Mailinator navigation before the
  // new message arrives; freshness is proven by the new msgid instead.
  const baselineMessageIds = await mailinator.snapshotMessageIds();

  await page.bringToFront();
  const otpRequest = await trackingPage.requestVerificationCode(orderNumber, email);

  await mailPage.bringToFront();
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