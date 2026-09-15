import fs from "node:fs";
import path from "node:path";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const guestOrderRuntimeFile = path.resolve("test-results/mx-qst/latest-guest-order.json");

test.describe.configure({ timeout: 900000 });

function loadLatestGuestOrder() {
  if (!fs.existsSync(guestOrderRuntimeFile)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(guestOrderRuntimeFile, "utf8"));
    if (String(value.market || "").toLowerCase() !== "mx") return null;
    return value;
  } catch {
    return null;
  }
}

test("SAM-25010 @qst @mx @base-store @safe - Track Order with email and Order ID", async ({ page, context, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25010"));

  const savedOrder = loadLatestGuestOrder();
  const orderNumber = process.env.MX_QST_TRACKING_ORDER?.trim() || savedOrder?.orderNumber?.trim();
  const email = (process.env.MX_QST_TRACKING_EMAIL?.trim() || savedOrder?.email?.trim())?.toLowerCase();
  const inbox = process.env.MAILINATOR_INBOX?.trim() || savedOrder?.inbox?.trim();

  test.skip(
    !orderNumber || !email || !inbox,
    "No reusable MX guest order was found. Run the authorized guest-order flow first, or provide MX_QST_TRACKING_ORDER, MX_QST_TRACKING_EMAIL and MAILINATOR_INBOX overrides."
  );
  test.skip(
    email !== `${inbox}@mailinator.com`.toLowerCase(),
    "The MX guest order email and Mailinator inbox must identify the same public test inbox."
  );
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
      type: "guest-tracking-source",
      description: process.env.MX_QST_TRACKING_ORDER ? "runtime-env-override" : "latest-mx-guest-order",
    },
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
