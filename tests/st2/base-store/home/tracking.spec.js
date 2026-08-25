import { test } from "@playwright/test";
import HomePage from "../../../../pages/HomePage";
test.describe("ST2 - Base Store - Guest Order Tracking", () => {
 test("TC13 partial - Customer able to access guest order tracking entry", async ({ page }) => {
   test.setTimeout(120000);
   const homePage = new HomePage(page);
   await homePage.openHome();
   const ordersPage = await homePage.openGuestOrders();
   await ordersPage.screenshot({
     path: "evidence/screenshots/guest-order-tracking-entry.png",
     fullPage: false,
   });
   await ordersPage.close();
 });
});
