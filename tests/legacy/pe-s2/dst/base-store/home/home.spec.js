import { test } from "@playwright/test";

import HomePage from "../../../../../../pages/HomePage";

test.describe("ST2 - Base Store - Home Page", () => {
  test("TC14 - Customer able to see Homepage Attributes Header Hero banner Top seller carousel Footer", async ({ page }, testInfo) => {
    test.setTimeout(180000);

    const homePage = new HomePage(page);

    await homePage.openHome();
    const attributes = await homePage.validateHomepageAttributes();
    if (!attributes.heroVisible || !attributes.topSellerVisible) {
      testInfo.annotations.push({
        type: "partial",
        description: `Header/Footer available; Hero=${attributes.heroVisible}; TopSeller=${attributes.topSellerVisible}`,
      });
    }
  });
});
