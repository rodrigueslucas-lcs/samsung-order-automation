import { test, expect } from "@playwright/test";
import BackOfficePage from "../../../../../pages/BackOfficePage";
import BackOfficeSearchPage from "../../../../../pages/BackOfficeSearchPage";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import backofficeCredentials from "../../../../../utils/backofficeAdminCredentials.js";
import mxConfigModule from "../../../../../utils/mxConfig.js";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const { getBackOfficeAdminCredentials } = backofficeCredentials;
const { getMxConfig } = mxConfigModule;

const DEFAULT_MX_QST_ORDER_CODE = "MX260908-63926930";

test.describe.configure({ timeout: 360000 });

function requireS1Admin(testInfo) {
  const credentials = getBackOfficeAdminCredentials();
  test.skip(!credentials.password, "S1 BackOffice Admin password is required via the ignored local auth file or runtime env.");
  expect((process.env.BACKOFFICE_ENV || "s1").toLowerCase()).toBe("s1");
  testInfo.annotations.push({
    type: "backoffice-admin-user",
    description: credentials.username,
  });
  return credentials;
}

test("MX QST 18 @qst @mx @base-store @backoffice @safe - BackOffice login", async ({ page }, testInfo) => {
  const credentials = requireS1Admin(testInfo);
  const backOffice = new BackOfficePage(page);
  await backOffice.login({ ...credentials, authority: "admin" });
  await backOffice.expectPerspective("admin");
});

test("SAM-25011 @qst @mx @base-store @backoffice @safe - BackOffice order and product basic advanced search", async ({ page }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25011"));

  const credentials = requireS1Admin(testInfo);
  const mxConfig = getMxConfig();
  const orderCode = process.env.MX_QST_ORDER_CODE || DEFAULT_MX_QST_ORDER_CODE;
  const productCode = process.env.MX_QST_PRODUCT_CODE || mxConfig.sku;
  expect(orderCode).toMatch(/^MX/i);
  expect(productCode).toBeTruthy();

  const backOffice = new BackOfficeSearchPage(page);
  await backOffice.login({ ...credentials, authority: "admin" });

  await backOffice.openAdminOrders();
  const basicOrderRow = await backOffice.searchAdminOrder(orderCode);
  await expect(basicOrderRow).toBeVisible();

  await backOffice.openAdminOrders();
  const advancedOrderRow = await backOffice.searchAdminOrderAdvanced(orderCode);
  await expect(advancedOrderRow).toBeVisible();

  await backOffice.openAdminOrders();
  await backOffice.openAdminOrderByCode(orderCode);
  const status = await backOffice.readOpenAdminOrderStatus(orderCode);
  expect(status).toBeTruthy();

  await backOffice.validateProductBasicAndAdvancedSearch(productCode);

  recordBusinessEvidence(testInfo, {
    orderCode,
    productCode,
    basicOrderSearch: true,
    advancedOrderSearch: true,
    basicProductSearch: true,
    advancedProductSearch: true,
    finalStatus: status,
  });

  console.log(
    "MX_QST_BACKOFFICE_SEARCH",
    JSON.stringify({ orderCode, productCode, status, basic: true, advanced: true })
  );
});
