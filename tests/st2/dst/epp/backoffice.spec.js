import BackOfficePage from "../../../../pages/BackOfficePage";
import BackOfficeOrderPage from "../../../../pages/BackOfficeOrderPage";
import BackOfficeCronJobsPage from "../../../../pages/BackOfficeCronJobsPage";
import { test, expect } from "@playwright/test";

const url = process.env.EPP_BACKOFFICE_URL;
const credentials = { username: process.env.BACKOFFICE_USERNAME, password: process.env.BACKOFFICE_PASSWORD };
const orderCode = process.env.EPP_ORDER_CODE;

function requireBackOffice(testInfo, { order = false } = {}) {
  testInfo.skip(!url, "Set EPP_BACKOFFICE_URL after the EPP BackOffice mapping is confirmed.");
  testInfo.skip(!credentials.username || !credentials.password, "Runtime BackOffice credentials are required.");
  testInfo.skip(order && !orderCode, "Set EPP_ORDER_CODE for read-only order validation.");
  const target = new URL(url);
  if (!/model-t\.cc\.commerce\.ondemand\.com$/i.test(target.hostname)) {
    throw new Error(`Refusing unverified EPP BackOffice host: ${target.hostname}`);
  }
}

test("TC47 @dst @epp @backoffice - EPP BackOffice login", async ({ page }, testInfo) => {
  requireBackOffice(testInfo);
  const backOffice = new BackOfficePage(page, { url });
  await backOffice.login({ ...credentials, authority: "admin" });
});

test("TC48 @dst @epp @backoffice - EPP Admin order view", async ({ page }, testInfo) => {
  requireBackOffice(testInfo);
  const orders = new BackOfficeOrderPage(page, { url });
  await orders.login({ ...credentials, authority: "admin" });
  await orders.openAdminOrders();
});

test("TC49 TC52 @dst @epp @backoffice - EPP CS order search", async ({ page }, testInfo) => {
  requireBackOffice(testInfo, { order: true });
  const orders = new BackOfficeOrderPage(page, { url });
  await orders.login({ ...credentials, authority: "agent" });
  await orders.expectAgentOrders();
  const order = await orders.openOrderByCode(orderCode);
  expect(order.orderCode).toBe(orderCode);
});

test("TC51 @dst @epp @backoffice - EPP CronJobs page read-only", async ({ page }, testInfo) => {
  requireBackOffice(testInfo);
  const cronJobs = new BackOfficeCronJobsPage(page, { url });
  await cronJobs.login({ ...credentials, authority: "admin" });
  await cronJobs.openCronJobs();
});
