import { expect, test } from "@playwright/test";
import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";

const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

const credentials = {
  username: process.env.BACKOFFICE_USERNAME,
  password: process.env.BACKOFFICE_PASSWORD,
};

function requirePeS1BackOffice(testInfo, zephyrId) {
  test.skip(
    (process.env.BACKOFFICE_ENV || "").toLowerCase() !== "s1",
    "Set BACKOFFICE_ENV=s1 for PE S1 BackOffice validation."
  );
  test.skip(
    !credentials.username || !credentials.password,
    "BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime."
  );
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(zephyrId));
}

test.use({ screenshot: "off", video: "off", trace: "off" });

test("SAM-25103 @qst @pe @base-store @backoffice @safe @reuse - Backoffice search baseline", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  requirePeS1BackOffice(testInfo, "SAM-25103");

  const orders = new BackOfficeOrderPage(page);
  await orders.login({ ...credentials, authority: "admin" });
  await orders.openAdminOrders();
  const order = await orders.openFirstAdminOrderAndReadStatus();

  expect(order.orderCode).toBeTruthy();
  expect(order.status).toBeTruthy();
  recordBusinessEvidence(testInfo, {
    orderCode: order.orderCode,
    finalStatus: order.status,
  });
  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "S1 Admin order search/read baseline is proven by this test when it passes. Official SAM-25103 still requires product search plus basic/advanced search coverage before Full.",
  });
});

test("SAM-25104 @qst @pe @base-store @backoffice @safe @reuse - Order Process Shipping Requested baseline", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  requirePeS1BackOffice(testInfo, "SAM-25104");

  const orderCode = String(process.env.PE_QST_ORDER_CODE || "").trim();
  test.skip(
    !orderCode,
    "Set PE_QST_ORDER_CODE to the specific PE order whose S1 fulfillment status is being verified."
  );

  const orders = new BackOfficeOrderPage(page);
  await orders.login({ ...credentials, authority: "admin" });
  await orders.openAdminOrders();
  await orders.openAdminOrderByCode(orderCode);
  const status = await orders.readOpenAdminOrderStatus(orderCode);

  expect(status.toLowerCase()).toBe("shipping requested");
  recordBusinessEvidence(testInfo, {
    orderCode,
    finalStatus: status,
  });
  testInfo.annotations.push({
    type: "qst-reuse-note",
    description: "Read-only Shipping Requested verification only. Official SAM-25104 requires causal proof that the same placed order reached this status; no cron or state-changing action is executed here.",
  });
});
