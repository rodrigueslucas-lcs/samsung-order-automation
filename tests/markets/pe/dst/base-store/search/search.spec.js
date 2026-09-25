import { test, expect } from "@playwright/test";
import SearchComponent from "../../../../../../pages/SearchComponent";
test.describe("ST2 - Base Store - Search", () => {
 test("Search - autocomplete suggestions and related product behavior", async ({ page }) => {
   test.setTimeout(180000);
   await page.goto(
     "https://stg2.shop.samsung.com/getcookie.html",
     {
       waitUntil: "domcontentloaded",
     }
   );
   await expect(
     page.getByText(/You can access pages now/i)
   ).toBeVisible({
     timeout: 30000,
   });
   await page.goto(
     "https://stg2.shop.samsung.com/pe/",
     {
       waitUntil: "domcontentloaded",
     }
   );
   await expect(page).toHaveURL(
     /stg2\.shop\.samsung\.com\/pe\//
   );
   const search = new SearchComponent(page);
   await search.validateAutocompleteToSt2Pdp();
 });
});
