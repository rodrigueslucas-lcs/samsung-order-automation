import { test, expect } from "@playwright/test";
import BackOfficePage from "../../../../../pages/BackOfficePage";
import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 240000 });

test("MX QST 18 @qst @mx @base-store @backoffice @safe - BackOffice login", async ({ page }) => {
  const username = process.env.BACKOFFICE_ADMIN_USERNAME;
  const password = process.env.BACKOFFICE_ADMIN_PASSWORD;
  test.skip(!username || !password, "S1 BackOffice Admin credentials are required at runtime.");
  expect((process.env.BACKOFFICE_ENV || "").toLowerCase()).toBe("s1");
  const backOffice = new BackOfficePage(page);
  await backOffice.login({ username, password, authority: "admin" });
  await backOffice.expectPerspective("admin");
});

test("SAM-25011 @qst @mx @base-store @backoffice @safe - BackOffice order search", async ({ page }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25011"));

  const username = process.env.BACKOFFICE_ADMIN_USERNAME;
  const password = process.env.BACKOFFICE_ADMIN_PASSWORD;
  const orderCode = process.env.MX_QST_ORDER_CODE;
  test.skip(!username || !password || !orderCode, "S1 Admin credentials and MX_QST_ORDER_CODE are required.");
  expect((process.env.BACKOFFICE_ENV || "").toLowerCase()).toBe("s1");
  expect(orderCode).toMatch(/^MX/i);
  const orders = new BackOfficeOrderPage(page);
  await orders.login({ username, password, authority: "admin" });
  await orders.openAdminOrders();
  await orders.openAdminOrderByCode(orderCode);
  const status = await orders.readOpenAdminOrderStatus(orderCode);
  expect(status).toBeTruthy();
  recordBusinessEvidence(testInfo, { orderCode, finalStatus: status });
  console.log("MX_QST_ORDER_STATUS", JSON.stringify({ orderCode, status }));
});
