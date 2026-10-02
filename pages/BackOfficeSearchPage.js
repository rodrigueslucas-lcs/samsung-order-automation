import { expect } from "@playwright/test";
import BackOfficeOrderPage from "./BackOfficeOrderPage";
import BackOfficeCatalogPage from "./BackOfficeCatalogPage";

export default class BackOfficeSearchPage extends BackOfficeOrderPage {
  async openAdvancedSearch() {
    const advancedSearch = this.page.locator(".yw-advancedsearch:visible").first();
    if (await advancedSearch.isVisible().catch(() => false)) return;

    const quickSearch = await this.ensureAdminBasicSearch();
    await quickSearch.waitFor({ state: "visible", timeout: 30000 });

    const advancedButton = this.page
      .locator('button.yw-toggle-advanced-search[title="Switch search mode"]:visible')
      .first();
    await advancedButton.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advancedButton.click());
    await advancedSearch.waitFor({
      state: "visible",
      timeout: 30000,
    });
  }

  async searchAdminOrderAdvanced(orderCode) {
    await this.openAdvancedSearch();

    // BackOffice S2 has two valid Advanced Search renderings:
    // a row-based form and a ZK grid where label/input are separate cells.
    // Scope to the visible advanced-search container instead of requiring the
    // textbox to be a descendant of the "Order Nr." row.
    const advancedSearch = this.page.locator(".yw-advancedsearch:visible").first();
    await advancedSearch.waitFor({ state: "visible", timeout: 30000 });

    let orderField = advancedSearch
      .getByRole("textbox")
      .filter({ visible: true })
      .first();

    const inputs = advancedSearch.locator('input:visible:not([type="hidden"])');
    if (!(await orderField.isVisible().catch(() => false))) {
      orderField = inputs.first();
    }

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
