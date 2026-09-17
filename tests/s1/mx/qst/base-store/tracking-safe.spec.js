import fs from "node:fs";
import path from "node:path";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

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
  return String(value || "").match(/\bMX\d{6}-\d{8}\b/i)?.[0] || null;
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

test("SAM-25010 @destructive @qst @mx @base-store - Track Order with email and Order ID", async ({ page, context, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25010"));

  let orderNumber = normalizeMxOrderCode(process.env.MX_QST_TRACKING_ORDER?.trim());
  let email = process.env.MX_QST_TRACKING_EMAIL?.trim().toLowerCase();
  let inbox = process.env.MAILINATOR_INBOX?.trim();

  if (!orderNumber || !email || !inbox) {
    const causalOrder = readGuestOrderRuntime();
    if (causalOrder) ({ orderNumber, email, inbox } = causalOrder);
  }

  if (!orderNumber || !email || !inbox) {
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
