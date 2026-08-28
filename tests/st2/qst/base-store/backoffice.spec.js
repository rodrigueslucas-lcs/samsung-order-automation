import { expect, test } from "@playwright/test";
import BackOfficePage from "../../../../pages/BackOfficePage";
import BackOfficeOrderPage from "../../../../pages/BackOfficeOrderPage";
import { annotateQstExecution } from "../../../../utils/qstExecutionSummary";

const credentials = {
  username: process.env.BACKOFFICE_USERNAME,
  password: process.env.BACKOFFICE_PASSWORD,
};
const environment = (process.env.BACKOFFICE_ENV || "s2").toLowerCase();
const orderFallbacks = {
  s2: "PE260819-75543032_260819182727780",
  s3: "PE260817-69932056_260821145428295",
};
const shippingFallback = "PE260814-69911059";

test.use({ screenshot: "off", video: "off", trace: "off" });

test.describe("QST Base Store - BackOffice read-only", () => {
  test.describe.configure({ timeout: 300000 });
  test.skip(
    !credentials.username || !credentials.password,
    "BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime."
  );

  test("QST-BS-18 @qst @qst-normal @base-store - BackOffice login", async ({ page }, testInfo) => {
    annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
    const backOffice = new BackOfficePage(page);
    await backOffice.login({ ...credentials, authority: "admin" });
    await backOffice.expectPerspective("admin");
  });

  test("QST-BS-19 @qst @qst-normal @base-store - Read order status", async ({ page }, testInfo) => {
    annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
    const orders = new BackOfficeOrderPage(page);
    const orderCode = process.env.BACKOFFICE_ORDER_CODE || orderFallbacks[environment];
    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();
    const order = await orders.openOrderByCode(orderCode);
    expect(order.orderCode).toBe(orderCode);
    expect(order.hybrisStatus).toBeTruthy();
    testInfo.annotations.push({ type: "qst-order", description: orderCode });
  });

  test("QST-BS-22 @qst @qst-normal @base-store - Shipping Requested is visible", async ({ page }, testInfo) => {
    annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
    test.skip(environment !== "s3", "Shipping Requested read-only fallback is verified for S3 only.");
    const orders = new BackOfficeOrderPage(page);
    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();
    const order = await orders.findOrOpenOrderByHybrisStatus(
      "Shipping Requested",
      process.env.BACKOFFICE_SHIPPING_ORDER_CODE || shippingFallback
    );
    expect(order.hybrisStatus).toBe("Shipping Requested");
    testInfo.annotations.push({ type: "qst-order", description: order.orderCode });
  });
});
