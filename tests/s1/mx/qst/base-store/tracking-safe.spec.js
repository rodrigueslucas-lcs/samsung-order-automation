import fs from "node:fs";
import path from "node:path";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 1200000, retries: 0 });
const guestOrderRuntimeFile = path.resolve("test-results/mx-qst/latest-guest-order.json");

function normalizeMxOrderCode(value) {
  return String(value || "").match(/\bMX\d{6}-\d{8}\b/i)?.[0] || null;
}

function readGuestOrderRuntime() {
  if (!fs.existsSync(guestOrderRuntimeFile)) return null;
  const value = JSON.parse(fs.readFileSync(guestOrderRuntimeFile, "utf8"));
  const orderNumber = normalizeMxOrderCode(value.orderNumber);
  const email = String(value.email || "").trim().toLowerCase();
  const inbox = String(value.inbox || "").trim();
  return orderNumber && email && inbox ? { orderNumber, email, inbox, confirmed: value.confirmed === true } : null;
}

function preserveGuestOrderCandidate(orderNumber, email, inbox, confirmed = false) {
  if (!orderNumber) return;
  fs.mkdirSync(path.dirname(guestOrderRuntimeFile), { recursive: true });
  const temporary = `${guestOrderRuntimeFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ orderNumber, email, inbox, confirmed }, null, 2));
  try {
    fs.renameSync(temporary, guestOrderRuntimeFile);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`Could not persist MX guest order runtime safely: ${error.message}`);
  }
}

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
  let body = await target.locator("body").innerText({ timeout: 30000 }).catch(() => "");
  const returnHref = await target.getByRole("link", { name: /Volver a la tienda/i })
    .getAttribute("href").catch(() => null);
  let orderNumber = normalizeMxOrderCode(body) || normalizeMxOrderCode(responseOrderCode) || normalizeMxOrderCode(returnHref);
  preserveGuestOrderCandidate(orderNumber, email, inbox);

  if (new URL(target.url()).hostname === "www.mercadopago.com.mx") {
    const spei = target.getByRole("button", { name: /Transferencia SPEI/i });
    await spei.waitFor({ state: "visible", timeout: 60000 });
    await spei.click();

    // Mercado Pago requires a separate review confirmation after choosing
    // SPEI. Capture the causal MX code from its return URL, then confirm once.
    const review = target.getByRole("heading", { name: /^Revisa tu pago$/i });
    await review.waitFor({ state: "visible", timeout: 60000 });
    const reviewReturnHref = await target
      .getByRole("link", { name: /Volver a la tienda/i })
      .getAttribute("href");
    orderNumber ||= normalizeMxOrderCode(reviewReturnHref);
    preserveGuestOrderCandidate(orderNumber, email, inbox);
    const confirm = target.getByRole("button", { name: /^Continuar$/i });
    await expect(confirm).toBeEnabled({ timeout: 30000 });
    await confirm.click();

    const instructions = target.getByRole("heading", {
      name: /^Ahora solo falta finalizar el pago$/i,
    });
    const paymentOutcome = await Promise.any([
      instructions.waitFor({ state: "visible", timeout: 120000 }).then(() => "instructions"),
      target.getByRole("heading", { name: /No pudimos procesar tu pago/i })
        .waitFor({ state: "visible", timeout: 120000 }).then(() => "rejected"),
    ]);
    if (paymentOutcome === "rejected") {
      throw new Error(`Mercado Pago rejected the SPEI prerequisite for ${orderNumber || "the MX cart"}; do not submit again. The candidate order was preserved for tracking-only follow-up.`);
    }
    const returnToStore = target.getByRole("link", { name: /Volver a la tienda/i });
    const instructionsReturnHref = await returnToStore.getAttribute("href");
    orderNumber ||= normalizeMxOrderCode(instructionsReturnHref);
    await returnToStore.click();
    await target.waitForURL((url) => url.hostname === mxConfig.hostname, { timeout: 120000 });
    await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
    body = await target.locator("body").innerText({ timeout: 30000 }).catch(() => "");
    orderNumber ||= normalizeMxOrderCode(body) || normalizeMxOrderCode(target.url());
    preserveGuestOrderCandidate(orderNumber, email, inbox, true);
  }
  if (!orderNumber) {
    throw new Error("SAM-25010 prerequisite submit produced no observable MX order code; do not retry automatically.");
  }

  return { orderNumber, email, inbox };
}

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
  const baselineMessageIds = await mailinator.snapshotMessageIds();
  const baselineOtpCodes = await mailinator.snapshotOtpCodes();

  await page.bringToFront();
  const otpRequest = await trackingPage.requestVerificationCode(orderNumber, email);

  await mailPage.bringToFront();
  const otpEmail = await mailinator.waitForOtpEmail({ baselineMessageIds, baselineOtpCodes });

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
