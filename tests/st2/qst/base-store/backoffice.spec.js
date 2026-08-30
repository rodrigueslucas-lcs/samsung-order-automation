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
  s1: null,
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
    if (environment === "s1") {
      await orders.login({ ...credentials, authority: "admin" });
      await orders.openAdminOrders();
      const order = await orders.openFirstAdminOrderAndReadStatus();
      testInfo.annotations.push({ type: "qst-order", description: order.orderCode });
      testInfo.annotations.push({ type: "qst-order-status", description: order.status });
      return;
    }

    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();
    const order = orderCode
      ? await orders.openOrderByCode(orderCode)
      : (await orders.readVisibleAgentOrders()).find(
          (candidate) => candidate.orderCode && candidate.hybrisStatus
        );
    expect(order, "No S1 order with a readable Hybris status was visible.").toBeTruthy();
    if (orderCode) expect(order.orderCode).toBe(orderCode);
    expect(order.hybrisStatus).toBeTruthy();
    testInfo.annotations.push({ type: "qst-order", description: order.orderCode });
  });

  test("QST-BS-22 @qst @qst-normal @base-store - Shipping Requested is visible", async ({ page }, testInfo) => {
    test.setTimeout(900000);
    annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
    test.skip(
      !["s1", "s3"].includes(environment),
      "Shipping Requested read-only discovery is enabled for S1/S3 staging only."
    );
    const orders = new BackOfficeOrderPage(page);
    if (environment === "s1") {
      await orders.login({ ...credentials, authority: "admin" });
      await orders.openAdminOrders();
      const inspected = await orders.scanVisibleAdminOrderStatuses({ limit: 50 });
      for (const status of [
        "Waiting for Send Financial",
        "Order Split",
        "Shipping Requested",
      ]) {
        const matches = inspected.filter(
          (order) => order.status.toLowerCase() === status.toLowerCase()
        );
        testInfo.annotations.push({
          type: `s1-${status.toLowerCase().replaceAll(" ", "-")}`,
          description: matches.map((order) => order.orderCode).join(", ") || "none",
        });
      }
      const shipping = inspected.find(
        (order) => order.status.toLowerCase() === "shipping requested"
      );
      expect(
        shipping,
        `No Shipping Requested order found among ${inspected.length} visible S1 Admin orders. ` +
          `Observed: ${inspected.map((order) => `${order.orderCode}=${order.status}`).join(" | ")}`
      ).toBeTruthy();
      testInfo.annotations.push({ type: "qst-order", description: shipping.orderCode });
      return;
    }

    await orders.login({ ...credentials, authority: "agent" });
    await orders.expectAgentOrders();
    const order = await orders.findOrOpenOrderByHybrisStatus(
      "Shipping Requested",
      process.env.BACKOFFICE_SHIPPING_ORDER_CODE ||
        (environment === "s3" ? shippingFallback : undefined)
    );
    expect(order.hybrisStatus).toBe("Shipping Requested");
    testInfo.annotations.push({ type: "qst-order", description: order.orderCode });
  });
});
