import { test } from "@playwright/test";
import HomePage from "../../../../pages/HomePage";
import GuestOrderTrackingPage from "../../../../pages/GuestOrderTrackingPage";
test.describe("ST2 - Base Store - Guest Order Tracking", () => {
 test("TC13 partial - Customer able to validate guest order tracking flow", async ({ page }) => {
   test.setTimeout(120000);
   const homePage = new HomePage(page);
   await homePage.openHome();
   const ordersPage = await homePage.openGuestOrders();
   const trackingPage = new GuestOrderTrackingPage(ordersPage);
   await trackingPage.validateGuestTrackingForm();
   await trackingPage.validateRequiredAndEmailMessages();
   await trackingPage.validateInvalidVerificationRequest();

   const runtimeOrder = process.env.STOREFRONT_GUEST_ORDER;
   const runtimeEmail = process.env.STOREFRONT_GUEST_EMAIL;
   if (runtimeOrder && runtimeEmail) {
     const otpRequest = await trackingPage.requestVerificationCode(
       runtimeOrder,
       runtimeEmail
     );
     test.info().annotations.push({
       type: "guest-otp-request",
       description: `${otpRequest.method} ${otpRequest.status} ${otpRequest.endpoint}; accepted=${otpRequest.accepted}`,
     });
   }
   await ordersPage.screenshot({
     path: "evidence/screenshots/guest-order-tracking-entry.png",
     fullPage: false,
   });
 });
});
