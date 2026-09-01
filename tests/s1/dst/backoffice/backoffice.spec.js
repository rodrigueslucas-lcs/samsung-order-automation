import { test, expect } from "@playwright/test";
import BackOfficePage from "../../../../pages/BackOfficePage";
import BackOfficeOrderPage from "../../../../pages/BackOfficeOrderPage";
import BackOfficeCronJobsPage from "../../../../pages/BackOfficeCronJobsPage";

test.use({ screenshot: "off", video: "off", trace: "off" });
test.describe.configure({ timeout: 240000 });

const orderCode = process.env.BACKOFFICE_ORDER_CODE;

test("MX TC65 @dst @mx @backoffice - Admin login", async ({ page }) => {
  const username = process.env.BACKOFFICE_ADMIN_USERNAME;
  const password = process.env.BACKOFFICE_ADMIN_PASSWORD;
  test.skip(!username || !password, "Admin credentials are required.");
  const backOffice = new BackOfficePage(page);
  await backOffice.login({ username, password, authority: "admin" });
  await backOffice.expectPerspective("admin");
});

test("MX TC66 @dst @mx @backoffice - Admin Orders page", async ({ page }) => {
  const username = process.env.BACKOFFICE_ADMIN_USERNAME;
  const password = process.env.BACKOFFICE_ADMIN_PASSWORD;
  test.skip(!username || !password, "Admin credentials are required.");
  const orders = new BackOfficeOrderPage(page);
  await orders.login({ username, password, authority: "admin" });
  await orders.openAdminOrders();
  await expect(page.getByPlaceholder("Type to search", { exact: true }).last()).toBeVisible();
});

test("MX TC72 @dst @mx @backoffice - Current order search", async ({ page }) => {
  const username = process.env.BACKOFFICE_ADMIN_USERNAME;
  const password = process.env.BACKOFFICE_ADMIN_PASSWORD;
  test.skip(!username || !password || !orderCode, "Admin credentials and current order are required.");
  const orders = new BackOfficeOrderPage(page);
  await orders.login({ username, password, authority: "admin" });
  await orders.openAdminOrders();
  const result = await orders.searchAdminOrder(orderCode);
  await expect(result).toContainText(orderCode);
});

test("MX TC67 @dst @mx @backoffice - CS Agent Orders page", async ({ page }) => {
  const username = process.env.BACKOFFICE_CS_USERNAME;
  const password = process.env.BACKOFFICE_CS_PASSWORD;
  test.skip(!username || !password, "CS credentials are required.");
  const orders = new BackOfficeOrderPage(page);
  await orders.login({ username, password, authority: "agent" });
  await orders.expectAgentOrders();
});

test("MX TC70 @dst @mx @backoffice - CronJobs page is visible", async ({ page }) => {
  const username = process.env.BACKOFFICE_ADMIN_USERNAME;
  const password = process.env.BACKOFFICE_ADMIN_PASSWORD;
  test.skip(!username || !password, "Admin credentials are required.");
  const cronJobs = new BackOfficeCronJobsPage(page);
  await cronJobs.login({ username, password, authority: "admin" });
  await cronJobs.openCronJobs();
  await expect(page.getByText(/CronJobs/i).filter({ visible: true }).first()).toBeVisible();
});
