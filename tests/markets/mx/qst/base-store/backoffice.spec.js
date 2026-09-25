import { test, expect } from "@playwright/test";
import BackOfficePage from "../../../../../pages/BackOfficePage";
import BackOfficeSearchPage from "../../../../../pages/BackOfficeSearchPage";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import backofficeCredentials from "../../../../../utils/backofficeAdminCredentials.js";
import mxConfigModule from "../../../../../utils/mxConfig.js";
import mxBackofficeTestData from "../../../../../utils/mxBackofficeTestData.js";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const { getBackOfficeAdminCredentials } = backofficeCredentials;
const { getMxConfig } = mxConfigModule;
const { getMxBackofficeTestData } = mxBackofficeTestData;

test.describe.configure({ timeout: 360000 });

function requireMxAdmin(testInfo) {
  const credentials = getBackOfficeAdminCredentials();
  const storefrontEnvironment = (process.env.MX_QST_ENVIRONMENT || "S1").toLowerCase();
  test.skip(
    !credentials.password,
    `MX BackOffice ${storefrontEnvironment.toUpperCase()} Admin password is required via its environment-specific ignored auth file or runtime env.`
  );
  expect(credentials.environment).toBe(storefrontEnvironment);
  expect((process.env.BACKOFFICE_ENV || storefrontEnvironment).toLowerCase()).toBe(storefrontEnvironment);
  testInfo.annotations.push({
    type: "backoffice-admin-user",
    description: credentials.username,
  });
  return credentials;
}

test("MX QST 18 @qst @mx @base-store @backoffice @safe - BackOffice login", async ({ page }, testInfo) => {
  const credentials = requireMxAdmin(testInfo);
  const backOffice = new BackOfficePage(page);
  await test.step("Authenticate in MX BackOffice as Admin", async () => {
    await backOffice.login({ ...credentials, authority: "admin" });
    await backOffice.expectPerspective("admin");
  });
});

test("SAM-25011 @qst @mx @base-store @backoffice @safe - BackOffice order and product basic advanced search", async ({ page }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25011"));

  const credentials = requireMxAdmin(testInfo);
  const mxConfig = getMxConfig();
  const testData = getMxBackofficeTestData();
  expect(testData.environment).toBe(mxConfig.environment);
  const { orderCode, productCode } = testData;
  expect(orderCode).toMatch(/^MX/i);
  expect(productCode).toBeTruthy();

  const backOffice = new BackOfficeSearchPage(page);
  await test.step("Authenticate and validate the target BackOffice environment", async () => {
    await backOffice.login({ ...credentials, authority: "admin" });
    expect(new URL(page.url()).hostname).toContain(`-${mxConfig.environment.toLowerCase()}-public.`);
    expect(new URL(page.url()).hostname).not.toContain(
      `-${mxConfig.environment === "S2" ? "s1" : "s2"}-public.`
    );
  });

  const basicOrderRow = await test.step("Validate basic order search", async () => {
    await backOffice.openAdminOrders();
    const row = await backOffice.searchAdminOrder(orderCode);
    await expect(row).toBeVisible();
    return row;
  });
  await expect(basicOrderRow).toBeVisible();

  const advancedOrderRow = await test.step("Validate advanced order search", async () => {
    await backOffice.openAdminOrders();
    const row = await backOffice.searchAdminOrderAdvanced(orderCode);
    await expect(row).toBeVisible();
    return row;
  });
  await expect(advancedOrderRow).toBeVisible();

  const status = await test.step("Open the order and validate its current status", async () => {
    await backOffice.openAdminOrders();
    await backOffice.openAdminOrderByCode(orderCode);
    const currentStatus = await backOffice.readOpenAdminOrderStatus(orderCode);
    expect(currentStatus).toBeTruthy();
    return currentStatus;
  });

  await test.step("Validate basic and advanced product search", async () => {
    await backOffice.validateProductBasicAndAdvancedSearch(productCode);
  });

  recordBusinessEvidence(testInfo, {
    orderCode,
    productCode,
    basicOrderSearch: true,
    advancedOrderSearch: true,
    basicProductSearch: true,
    advancedProductSearch: true,
    finalStatus: status,
    environment: testData.environment,
    backOfficeHost: new URL(page.url()).hostname,
  });

  console.log(
    "MX_QST_BACKOFFICE_SEARCH",
    JSON.stringify({ environment: testData.environment, backOfficeHost: new URL(page.url()).hostname, orderCode, productCode, status, basic: true, advanced: true })
  );
});
