import { expect } from "@playwright/test";
import BackOfficeOrderPage from "./BackOfficeOrderPage";
import BackOfficeCatalogPage from "./BackOfficeCatalogPage";

export default class BackOfficeSearchPage extends BackOfficeOrderPage {
  async openAdvancedSearch() {
    const quickSearch = this.page.getByRole("textbox", { name: "Type to search" }).filter({ visible: true }).first();
    await quickSearch.waitFor({ state: "visible", timeout: 30000 });

    // SAP CX Backoffice renders the Advanced Search control as an icon-only
    // button next to the quick-search button, so it has no accessible text/title.
    const searchButton = quickSearch.locator("xpath=following::button[1]");
    const advancedButton = searchButton.locator("xpath=following::button[1]");
    await advancedButton.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advancedButton.click());
  }

  async searchAdminOrderAdvanced(orderCode) {
    await this.openAdvancedSearch();

    const orderField = this.page
      .getByRole("textbox", { name: /Order Number|Order No|Order Nr|Code/i })
      .or(this.page.locator('input[placeholder*="order" i]'))
      .filter({ visible: true })
      .first();
    await orderField.waitFor({ state: "visible", timeout: 30000 });
    await orderField.fill(orderCode);

    const searchButton = this.page
      .getByRole("button", { name: /^Search$/i })
      .or(this.page.locator('button[title="Search"]'))
      .filter({ visible: true })
      .last();
    await this.waitForZkUpdate(() => searchButton.click());

    const result = this.page.getByRole("row", {
      name: new RegExp(`Order Nr\\.: ${this.escapeRegExp(orderCode)}`),
    });
    await expect(result).toBeVisible({ timeout: 30000 });
    return result;
  }

  async validateProductBasicAndAdvancedSearch(productCode) {
    const catalog = new BackOfficeCatalogPage(this.page, { url: this.url });
    await catalog.openAdminProducts();
    await catalog.searchAdminProductBasic(productCode);

    await catalog.openAdminProducts();
    await catalog.searchAdminProductAdvanced(productCode);
  }
}
