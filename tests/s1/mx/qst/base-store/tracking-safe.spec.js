import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 1200000, retries: 0 });

async function createGuestOrderForTracking(page, mxConfig) {
  const inbox = `mx-qst-${Date.now()}`;
  const email = `${inbox}@mailinator.com`;
  const { checkout } = await reachMxGuestPayment(page, mxConfig, email);
  await checkout.selectPaymentMode(/^SPEI/i);

  let responseOrderCode = null;
  page.on("response", (response) => {
    if (!/order|payment|checkout|transaction/i.test(response.url())) return;
    response.text().then((body) => {
      responseOrderCode ||= body.match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || null;
    }).catch(() => {});
  });

  const action = page.getByRole("button", { name: /^Continuar a Mercado Pago$/i });
  await expect(action).toBeEnabled({ timeout: 30000 });
  const initialUrl = page.url();
  const popupPromise = page.context().waitForEvent("page", { timeout: 120000 }).catch(() => null);
  await action.click();

  // The order may already exist after this click. Never retry the submit blindly.
  const outcome = await Promise.race([
    page.waitForURL((url) => url.href !== initialUrl, { timeout: 120000 }).then(() => page),
    popupPromise,
  ]);
  const target = outcome || page;
  await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  const body = await target.locator("body").innerText({ timeout: 30000 }).catch(() => "");
  const orderNumber = body.match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || responseOrderCode;
  if (!orderNumber) {
    throw new Error("SAM-25010 prerequisite submit produced no observable MX order code; do not retry automatically.");
  }

  return { orderNumber, email, inbox };
}

test("SAM-25010 @destructive @qst @mx @base-store - Track Order with email and Order ID", async ({ page, context, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25010"));

  // Running SAM-25010 explicitly authorizes creation of at most one guest MX
  // prerequisite order when runtime overrides were not supplied.
  let orderNumber = process.env.MX_QST_TRACKING_ORDER?.trim();
  let email = process.env.MX_QST_TRACKING_EMAIL?.trim().toLowerCase();
  let inbox = process.env.MAILINATOR_INBOX?.trim();

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
