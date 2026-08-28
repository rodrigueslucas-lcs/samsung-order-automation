import { test } from "@playwright/test";
import GuestOrderTrackingPage from "../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../pages/MailinatorPage";

test.describe("ST2 - Base Store - Guest Order Tracking", () => {
  test("TC13 - Guest customer tracks an order with email OTP", async ({ page, context }, testInfo) => {
    test.setTimeout(900000);
    const orderNumber = process.env.GUEST_TRACKING_ORDER?.trim();
    const email = process.env.GUEST_TRACKING_EMAIL?.trim().toLowerCase();
    const inbox = process.env.MAILINATOR_INBOX?.trim();
    test.skip(
      !orderNumber || !email || !inbox,
      "Set GUEST_TRACKING_ORDER, GUEST_TRACKING_EMAIL and MAILINATOR_INBOX."
    );
    test.skip(
      email !== `${inbox}@mailinator.com`.toLowerCase(),
      "GUEST_TRACKING_EMAIL and MAILINATOR_INBOX must identify the same public inbox."
    );

    await page.goto("https://stg2.shop.samsung.com/getcookie.html", {
      waitUntil: "domcontentloaded",
    });
    await page.getByText(/You can access pages now/i)
      .waitFor({ state: "visible", timeout: 30000 });
    await page.goto("https://stg2.shop.samsung.com/pe/mypage/orders", {
      waitUntil: "domcontentloaded",
    });
    const trackingPage = new GuestOrderTrackingPage(page);
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

    testInfo.annotations.push(
      { type: "guest-otp-request", description: `${otpRequest.method} ${otpRequest.status} ${otpRequest.endpoint}; accepted=${otpRequest.accepted}` },
      { type: "guest-otp-email", description: `${otpEmail.subject}; sender=${otpEmail.sender}; elapsedMs=${otpEmail.elapsedMs}` },
      { type: "guest-tracking-order", description: `${orderNumber}; status=${result.status}; product=${result.hasProduct}; summary=${result.hasOrderSummary}` },
    );
  });
});
