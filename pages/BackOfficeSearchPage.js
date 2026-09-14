import { expect } from "@playwright/test";
import BackOfficeOrderPage from "./BackOfficeOrderPage";
import BackOfficeCatalogPage from "./BackOfficeCatalogPage";

export default class BackOfficeSearchPage extends BackOfficeOrderPage {
  async openAdvancedSearch() {
    const quickSearch = this.page.getByRole("textbox", { name: "Type to search" }).filter({ visible: true }).first();
    await quickSearch.waitFor({ state: "visible", timeout: 30000 });

    const advancedButton = this.page
      .locator('button.yw-toggle-advanced-search[title="Switch search mode"]:visible')
      .first();
    await advancedButton.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advancedButton.click());
    await this.page.locator(".yw-advancedsearch:visible").first().waitFor({
      state: "visible",
      timeout: 30000,
    });
  }

  async searchAdminOrderAdvanced(orderCode) {
    await this.openAdvancedSearch();

    const orderField = this.page
      .getByRole("row")
      .filter({ has: this.page.getByText("Order Nr.", { exact: true }) })
      .filter({ visible: true })
      .first()
      .getByRole("textbox")
      .filter({ visible: true })
      .last();
    await orderField.waitFor({ state: "visible", timeout: 30000 });
    await orderField.fill(orderCode);

    const searchButton = this.page
      .getByRole("button", { name: "Search", exact: true })
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
