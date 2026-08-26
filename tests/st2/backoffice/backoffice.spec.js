import { expect, test } from "@playwright/test";
import BackOfficePage from "../../../pages/BackOfficePage";
import BackOfficeOrderPage from "../../../pages/BackOfficeOrderPage";
import BackOfficeCronJobsPage from "../../../pages/BackOfficeCronJobsPage";
const credentials = {
  username: process.env.BACKOFFICE_USERNAME,
  password: process.env.BACKOFFICE_PASSWORD,
};

const environmentOrderCodes = {
  s2: "PE260819-75543032_260819182727780",
  // TEMPORARY TEST DATA discovered read-only in the S3 CS order grid.
  s3: "PE260817-69932056_260821145428295",
};
const selectedEnvironment = (process.env.BACKOFFICE_ENV || "s2").toLowerCase();
const orderCode =
  process.env.BACKOFFICE_ORDER_CODE || environmentOrderCodes[selectedEnvironment];

test.use({ screenshot: "off", video: "off", trace: "off" });

const backOfficeEnvironment = (process.env.BACKOFFICE_ENV || "s2").toUpperCase();

test.describe(`ST2 Peru - BackOffice ${backOfficeEnvironment}`, () => {
  test.describe.configure({ timeout: 180000 });

  test.skip(
    !credentials.username || !credentials.password,
    "BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime."
  );

  test("TC64 - User able to login successfully in the BackOffice", async ({
    page,
  }) => {
    const backOffice = new BackOfficePage(page);
    await backOffice.login({ ...credentials, authority: "admin" });
    await backOffice.expectPerspective("admin");
  });

  test("TC65 - User able to see order page in Admin view", async ({ page }) => {
    const orders = new BackOfficeOrderPage(page);
    await orders.login({ ...credentials, authority: "admin" });
    await orders.openAdminOrders();
    await expect(
      page.getByPlaceholder("Type to search", { exact: true }).last()
    ).toBeVisible();
  });

  test("TC66 - User able to see order page in CS Agent view", async ({
    page,
  }) => {
    const orders = new BackOfficeOrderPage(page);
    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectPerspective("agent");
    await orders.expectAgentOrders();
  });

  test("TC69 - User able to view CronJobs page", async ({ page }) => {
    const cronJobs = new BackOfficeCronJobsPage(page);
    await cronJobs.login({ ...credentials, authority: "admin" });
    await cronJobs.openCronJobs();

    const financialJob = await cronJobs.searchCronJob(
      "pe-tokoFinancialInitialUpdateJob"
    );
    await expect(financialJob).toContainText("pe-tokoFinancialInitialUpdateJob");

    const warehouseJob = await cronJobs.searchCronJob(
      "pe-tokoTransferConsignmentToWarehouseJob"
    );
    await expect(warehouseJob).toContainText(
      "pe-tokoTransferConsignmentToWarehouseJob"
    );
  });

  test("TC71 - User able to search order via BackOffice order page", async ({
    page,
  }) => {
    const orders = new BackOfficeOrderPage(page);
    const useAgentSearch = selectedEnvironment === "s3";
    await orders.login({
      ...credentials,
      authority: useAgentSearch ? "agent" : "admin",
    });
    if (useAgentSearch) {
      await orders.expectAgentOrders();
    } else {
      await orders.openAdminOrders();
    }
    const result = useAgentSearch
      ? await orders.searchAgentOrder(orderCode)
      : await orders.searchAdminOrder(orderCode);
    await expect(result).toContainText(orderCode);
  });
});
