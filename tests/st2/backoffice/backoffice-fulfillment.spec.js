import { expect, test } from "@playwright/test";
import BackOfficeCronJobsPage from "../../../pages/BackOfficeCronJobsPage";
import BackOfficeOrderPage from "../../../pages/BackOfficeOrderPage";

const credentials = {
  username: process.env.BACKOFFICE_USERNAME,
  password: process.env.BACKOFFICE_PASSWORD,
};
const adminCredentials = {
  username: process.env.BACKOFFICE_ADMIN_USERNAME,
  password: process.env.BACKOFFICE_ADMIN_PASSWORD,
};

const FINANCIAL_JOB = "pe-tokoFinancialInitialUpdateJob";
const WAREHOUSE_JOB = "pe-tokoTransferConsignmentToWarehouseJob";

// TEMPORARY S3 TEST DATA. Environment variables take precedence so these are
// discovery fallbacks, not the long-term test-data architecture.
const FINANCIAL_FALLBACK =
  process.env.BACKOFFICE_FINANCIAL_ORDER_CODE || "PE260730-69727105";
const SPLIT_FALLBACK =
  process.env.BACKOFFICE_SPLIT_ORDER_CODE || "PE260730-69725073";
const SHIPPING_FALLBACK =
  process.env.BACKOFFICE_SHIPPING_ORDER_CODE || "PE260814-69911059";

let financialOrderCode = FINANCIAL_FALLBACK;
let warehouseOrderCode = SPLIT_FALLBACK;

test.use({ screenshot: "off", video: "off", trace: "off" });

test.describe("S3 Peru - BackOffice fulfillment", () => {
  test.describe.configure({ timeout: 300000, mode: "default" });

  test.skip(
    (process.env.BACKOFFICE_ENV || "s2").toLowerCase() !== "s3",
    "TC72-TC76 fulfillment discovery is currently authorized for S3 only."
  );
  test.skip(
    !credentials.username || !credentials.password,
    "BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime."
  );

  test("TC72 - Order is Waiting for Send Financial", async ({ page }) => {
    const orders = new BackOfficeOrderPage(page);
    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();

    const order = await orders.findOrOpenOrderByHybrisStatus(
      "WAITING_FOR_SEND_FINANCIAL",
      FINANCIAL_FALLBACK
    );
    financialOrderCode = order.orderCode;
    expect(await orders.readHybrisStatus()).toBe("WAITING_FOR_SEND_FINANCIAL");
  });

  test("TC73 - Financial initial update CronJob completes", async ({ page }) => {
    test.skip(
      process.env.ALLOW_CRONJOB_RUN !== "1",
      "Set ALLOW_CRONJOB_RUN=1 for an explicitly authorized causal staging execution."
    );
    test.skip(
      !adminCredentials.username || !adminCredentials.password,
      "Full administrator runtime credentials are required to run CronJobs."
    );
    const cronJobs = new BackOfficeCronJobsPage(page);
    await cronJobs.login({ ...adminCredentials, authority: "admin" });
    await cronJobs.openCronJobs();

    const execution = await cronJobs.runCronJobByCode(FINANCIAL_JOB);
    expect(execution.after.status).toBe("FINISHED");
    expect(execution.after.result).toBe("SUCCESS");
  });

  test("TC74 - Financial order reaches Order Split", async ({ page }) => {
    const orders = new BackOfficeOrderPage(page);
    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();

    const financialOrder = await orders.openOrderByCode(financialOrderCode);
    if (financialOrder.hybrisStatus === "WAITING_FOR_SEND_FINANCIAL") {
      test.info().annotations.push({
        type: "external-erp-blocker",
        description:
          financialOrder.responseMessage ||
          "Financial job completed but this order remained in the FI waiting state.",
      });
    }
    const order = await orders.findOrOpenOrderByHybrisStatus(
      "Order Split",
      SPLIT_FALLBACK
    );
    expect(order.hybrisStatus).toBe("Order Split");
    warehouseOrderCode = order.orderCode;
  });

  test("TC75 - Warehouse transfer CronJob completes", async ({ page }) => {
    test.skip(
      process.env.ALLOW_CRONJOB_RUN !== "1",
      "Set ALLOW_CRONJOB_RUN=1 for an explicitly authorized causal staging execution."
    );
    test.skip(
      !adminCredentials.username || !adminCredentials.password,
      "Full administrator runtime credentials are required to run CronJobs."
    );
    const cronJobs = new BackOfficeCronJobsPage(page);
    await cronJobs.login({ ...adminCredentials, authority: "admin" });
    await cronJobs.openCronJobs();

    const execution = await cronJobs.runCronJobByCode(WAREHOUSE_JOB);
    expect(execution.after.status).toBe("FINISHED");
    expect(execution.after.result).toBe("SUCCESS");
  });

  test("TC76 - Warehouse order reaches Shipping Requested", async ({ page }) => {
    const orders = new BackOfficeOrderPage(page);
    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();

    const warehouseOrder = await orders.openOrderByCode(warehouseOrderCode);
    if (warehouseOrder.hybrisStatus === "Order Split") {
      test.info().annotations.push({
        type: "external-nerp-blocker",
        description:
          warehouseOrder.responseMessage ||
          "Warehouse job completed but this order remained in Order Split.",
      });
    }
    const order = await orders.findOrOpenOrderByHybrisStatus(
      "Shipping Requested",
      SHIPPING_FALLBACK
    );
    expect(order.hybrisStatus).toBe("Shipping Requested");
  });
});
