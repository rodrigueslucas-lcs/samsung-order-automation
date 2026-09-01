import ProfilePage from "../../../../pages/ProfilePage";
import MyOrdersPage from "../../../../pages/MyOrdersPage";
import { test, expect } from "./epp.fixture";

test("TC03 @dst @epp - EPP authenticated profile menu", async ({ page, eppConfig }, testInfo) => {
  testInfo.skip(!eppConfig.accountUrl, "Set EPP_ACCOUNT_URL after the EPP account route is confirmed.");
  await page.goto(eppConfig.accountUrl.toString(), { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).hostname).toBe(eppConfig.hostname);
  const menu = await new ProfilePage(page).validateAuthenticatedMenu();
  expect(menu.profile).toBeGreaterThan(0);
  expect(menu.orders).toBeGreaterThan(0);
});

test("TC08 @dst @epp - EPP order list and details", async ({ page, eppConfig }, testInfo) => {
  const orderCode = process.env.EPP_ORDER_CODE;
  testInfo.skip(!eppConfig.ordersUrl, "Set EPP_ORDERS_URL after the EPP My Orders route is confirmed.");
  testInfo.skip(!orderCode, "Set EPP_ORDER_CODE to a QA EPP order for read-only validation.");
  await page.goto(eppConfig.ordersUrl.toString(), { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).hostname).toBe(eppConfig.hostname);
  const orders = new MyOrdersPage(page);
  expect(await orders.visibleOrderCode(orderCode)).toBeTruthy();
  await orders.openOrderDetails(orderCode);
  await orders.validateOrderDetails(orderCode, { sku: process.env.EPP_ORDER_SKU });
});
