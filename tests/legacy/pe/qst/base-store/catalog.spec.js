import { test } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import { annotateQstExecution } from "../../../../../utils/qstExecutionSummary";

test("QST-BS-04 @qst @qst-normal @qst-modified @base-store - Navigate to Hybris PDP", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const product = new ProductPage(page);
  await page.goto(product.cookieUrl, { waitUntil: "domcontentloaded" });
  await page.getByText(/You can access pages now/i).waitFor({ state: "visible", timeout: 30000 });
  await page.goto("https://stg2.shop.samsung.com/pe/p/RB45DG6300B1PE", {
    waitUntil: "domcontentloaded",
  });
  await product.validatePdp(page);
});
