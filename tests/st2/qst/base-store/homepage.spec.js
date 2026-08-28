import { test, expect } from "@playwright/test";
import HomePage from "../../../../pages/HomePage";
import { annotateQstExecution } from "../../../../utils/qstExecutionSummary";

test("QST-BS-01 @qst @qst-normal @qst-modified @qst-sanity @base-store - Homepage attributes", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const home = new HomePage(page);
  await home.openHome();
  const attributes = await home.validateHomepageAttributes();
  expect(attributes.headerVisible).toBe(true);
  expect(attributes.footerVisible).toBe(true);
  if (!attributes.heroVisible || !attributes.topSellerVisible) {
    testInfo.annotations.push({
      type: "qst-partial",
      description: `Hero=${attributes.heroVisible}; TopSeller=${attributes.topSellerVisible}`,
    });
  }
});
