import { test, expect } from "@playwright/test";
import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import sharedEvidenceMetadata from "../../../../../utils/qstSharedEvidenceMetadata";

const { recordBusinessEvidence } = evidenceContext;
const { getSharedQstEvidenceMetadata } = sharedEvidenceMetadata;

const credentials = {
  username: process.env.BACKOFFICE_USERNAME,
  password: process.env.BACKOFFICE_PASSWORD,
};

test.use({ screenshot: "off", video: "off", trace: "off" });

async function runBackOfficeBaseline({ page, testInfo, market, zephyrId, orderEnv }) {
  test.setTimeout(300000);
  test.skip(
    (process.env.BACKOFFICE_ENV || "").toLowerCase() !== "s1",
    "Set BACKOFFICE_ENV=s1 for SMB S1 BackOffice validation."
  );
  test.skip(
    !credentials.username || !credentials.password,
    "BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime."
  );

  const orderCode = String(process.env[orderEnv] || "").trim();
  test.skip(
    !orderCode,
    `Set ${orderEnv} to a known ${market} S1 order for market-scoped BackOffice evidence.`
  );

  recordBusinessEvidence(
    testInfo,
    getSharedQstEvidenceMetadata(market, zephyrId)
  );

  const orders = new BackOfficeOrderPage(page);
  await orders.login({ ...credentials, authority: "admin" });
  await orders.openAdminOrders();
  await orders.openAdminOrderByCode(orderCode);
  const status = await orders.readOpenAdminOrderStatus(orderCode);

  expect(status).toBeTruthy();
  recordBusinessEvidence(testInfo, { orderCode, finalStatus: status });
  testInfo.annotations.push({
    type: "qst-reuse-note",
    description:
      "Read-only exact-order BackOffice baseline. Full official Backoffice coverage still requires the source-defined product/basic/advanced search criteria to be live-proven.",
  });
}

test("SAM-24830 @qst @cl @backoffice @safe @reuse - Backoffice search baseline", async ({ page }, testInfo) => {
  await runBackOfficeBaseline({
    page,
    testInfo,
    market: "CL",
    zephyrId: "SAM-24830",
    orderEnv: "CL_QST_ORDER_CODE",
  });
});

test("SAM-24920 @qst @co @backoffice @safe @reuse - Backoffice search baseline", async ({ page }, testInfo) => {
  await runBackOfficeBaseline({
    page,
    testInfo,
    market: "CO",
    zephyrId: "SAM-24920",
    orderEnv: "CO_QST_ORDER_CODE",
  });
});
