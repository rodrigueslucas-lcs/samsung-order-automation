import { expect } from "@playwright/test";
import BackOfficeOrderPage from "./BackOfficeOrderPage";
import BackOfficeCatalogPage from "./BackOfficeCatalogPage";

export default class BackOfficeSearchPage extends BackOfficeOrderPage {
  async openAdvancedSearch() {
    const advanced = this.page
      .getByRole("button", { name: /Advanced Search|Advanced search/i })
      .or(this.page.locator('button[title*="Advanced" i]'))
      .filter({ visible: true })
      .first();
    await advanced.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advanced.click());
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
