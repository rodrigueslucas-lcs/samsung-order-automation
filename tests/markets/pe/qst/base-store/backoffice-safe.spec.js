import { expect, test } from "@playwright/test";
import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import backofficeCredentials from "../../../../../utils/backofficeAdminCredentials.js";

const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;
const { getBackOfficeAdminCredentials } = backofficeCredentials;

function requirePeBackOffice(testInfo, zephyrId) {
  const target = (process.env.PE_QST_ENVIRONMENT || "S2").toLowerCase();
  process.env.BACKOFFICE_ENV = target;
  const credentials = getBackOfficeAdminCredentials();
  test.skip(!credentials.password, `PE BackOffice ${target.toUpperCase()} Admin credentials are required via the shared environment-specific ignored auth file or runtime env.`);
  expect(credentials.environment).toBe(target);
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(zephyrId));
  return credentials;
}

test.use({ screenshot: "off", video: "off", trace: "off" });

test("SAM-25103 @qst @pe @base-store @backoffice @safe @reuse - Backoffice search baseline", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const credentials = requirePeBackOffice(testInfo, "SAM-25103");

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
    description: "S2 Admin order search/read baseline is proven by this test when it passes. Official SAM-25103 still requires product search plus basic/advanced search coverage before Full.",
  });
});

test("SAM-25104 @qst @pe @base-store @backoffice @safe @reuse - Order Process Shipping Requested baseline", async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const credentials = requirePeBackOffice(testInfo, "SAM-25104");

  const orderCode = String(process.env.PE_QST_ORDER_CODE || "").trim();
  test.skip(
    !orderCode,
    "Set PE_QST_ORDER_CODE to the specific PE order whose S2 fulfillment status is being verified."
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
