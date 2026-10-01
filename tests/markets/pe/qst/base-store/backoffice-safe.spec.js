import { expect, test } from "@playwright/test";
import BackOfficeSearchPage from "../../../../../pages/BackOfficeSearchPage";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import backofficeCredentials from "../../../../../utils/backofficeAdminCredentials.js";
import peBackofficeTestData from "../../../../../utils/peBackofficeTestData.js";

const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;
const { getBackOfficeAdminCredentials } = backofficeCredentials;
const { getPeBackofficeTestData } = peBackofficeTestData;

function requirePeBackOffice(testInfo, zephyrId) {
  const target = (process.env.PE_QST_ENVIRONMENT || "S2").toLowerCase();
  process.env.BACKOFFICE_ENV = target;
  const credentials = getBackOfficeAdminCredentials();
  test.skip(
    !credentials.password,
    `Shared BackOffice ${target.toUpperCase()} Admin credentials are required in playwright/.auth/backoffice-admin-${target}.json or the environment-specific runtime secret.`
  );
  expect(credentials.environment).toBe(target);
  testInfo.annotations.push({
    type: "backoffice-admin-user",
    description: credentials.username,
  });
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(zephyrId));
  return credentials;
}

test.describe("PE QST - BackOffice official coverage", () => {
  test.describe.configure({ timeout: 360000 });

  test("SAM-25103 @qst @pe @base-store @backoffice @safe @reuse - Backoffice search baseline", async ({ page }, testInfo) => {
    const credentials = requirePeBackOffice(testInfo, "SAM-25103");
    const testData = getPeBackofficeTestData();
    expect(testData.environment).toBe((process.env.PE_QST_ENVIRONMENT || "S2").toUpperCase());

    const backOffice = new BackOfficeSearchPage(page);
    await test.step("Authenticate in shared environment BackOffice as Admin", async () => {
      await backOffice.login({ ...credentials, authority: "admin" });
      await backOffice.expectPerspective("admin");
    });

    const basicOrderRow = await test.step("Validate basic order search", async () => {
      await backOffice.openAdminOrders();
      const row = await backOffice.searchAdminOrder(testData.orderCode);
      await expect(row).toBeVisible();
      return row;
    });
    await expect(basicOrderRow).toBeVisible();

    const advancedOrderRow = await test.step("Validate advanced order search", async () => {
      await backOffice.openAdminOrders();
      const row = await backOffice.searchAdminOrderAdvanced(testData.orderCode);
      await expect(row).toBeVisible();
      return row;
    });
    await expect(advancedOrderRow).toBeVisible();

    const status = await test.step("Open order and validate current status", async () => {
      await backOffice.openAdminOrders();
      await backOffice.openAdminOrderByCode(testData.orderCode);
      const currentStatus = await backOffice.readOpenAdminOrderStatus(testData.orderCode);
      expect(currentStatus).toBeTruthy();
      return currentStatus;
    });

    await test.step("Validate basic and advanced product search", async () => {
      await backOffice.validateProductBasicAndAdvancedSearch(testData.productCode);
    });

    recordBusinessEvidence(testInfo, {
      orderCode: testData.orderCode,
      productCode: testData.productCode,
      basicOrderSearch: true,
      advancedOrderSearch: true,
      basicProductSearch: true,
      advancedProductSearch: true,
      finalStatus: status,
      environment: testData.environment,
      backOfficeHost: new URL(page.url()).hostname,
    });
  });

  test("SAM-25104 @qst @pe @base-store @backoffice @safe @reuse - Order Process Shipping Requested baseline", async ({ page }, testInfo) => {
    const credentials = requirePeBackOffice(testInfo, "SAM-25104");
    const testData = getPeBackofficeTestData();

    const orders = new BackOfficeSearchPage(page);
    await test.step("Authenticate in shared environment BackOffice as Admin", async () => {
      await orders.login({ ...credentials, authority: "admin" });
      await orders.expectPerspective("admin");
    });
    await test.step("Open BackOffice Orders", async () => {
      await orders.openAdminOrders();
    });
    const status = await test.step("Open target PE order and validate Shipping Requested", async () => {
      await orders.openAdminOrderByCode(testData.orderCode);
      const currentStatus = await orders.readOpenAdminOrderStatus(testData.orderCode);
      expect(currentStatus.replace(/_/g, " ").trim().toLowerCase()).toBe("shipping requested");
      return currentStatus;
    });

    recordBusinessEvidence(testInfo, {
      orderCode: testData.orderCode,
      finalStatus: status,
      environment: testData.environment,
      backOfficeHost: new URL(page.url()).hostname,
    });
    testInfo.annotations.push({
      type: "qst-causality-note",
      description: "This official checkpoint validates the configured PE campaign order in the environment-scoped BackOffice. Fulfillment mutation remains outside this read-only S2 QST.",
    });
  });
});
