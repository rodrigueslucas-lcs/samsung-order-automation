import { test, expect } from "@playwright/test";

import ProductPage from "../../../../pages/ProductPage";

test.describe("ST2 - Base Store - Product Detail Page", () => {

  test("PDP - Product gallery specifications and recommendations smoke", async ({ page }) => {

    test.setTimeout(180000);

    // ST2 access setup

    await page.goto(

      "https://stg2.shop.samsung.com/getcookie.html",

      { waitUntil: "domcontentloaded" }

    );

    await expect(

      page.getByText(/You can access pages now/i)

    ).toBeVisible({

      timeout: 30000,

    });

    // PDP ST2

    await page.goto(

      "https://stg2.shop.samsung.com/pe/p/RB45DG6300B1PE",

      { waitUntil: "domcontentloaded" }

    );

    await expect(page).toHaveURL(

      /stg2\.shop\.samsung\.com\/pe\/p\/RB45DG6300B1PE/

    );

    const productPage = new ProductPage(page);

    await productPage.validatePdpDetails();

  });

});

