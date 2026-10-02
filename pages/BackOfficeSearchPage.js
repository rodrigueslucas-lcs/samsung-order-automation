import { expect } from "@playwright/test";
import BackOfficeOrderPage from "./BackOfficeOrderPage";
import BackOfficeCatalogPage from "./BackOfficeCatalogPage";

export default class BackOfficeSearchPage extends BackOfficeOrderPage {
  async openAdvancedSearch() {
    const quickSearch = this.page
      .getByPlaceholder("Type to search", { exact: true })
      .filter({ visible: true })
      .last();
    const orderLabel = this.page
      .getByText("Order Nr.", { exact: true })
      .filter({ visible: true })
      .first();

    // ZK keeps .yw-advancedsearch in the DOM even while Basic Search is active
    // in Jenkins/headless. Treat Advanced Search as active only when the Basic
    // search input is gone and the advanced Order Nr. field label is rendered.
    if (
      !(await quickSearch.isVisible().catch(() => false)) &&
      (await orderLabel.isVisible().catch(() => false))
    ) {
      return;
    }

    const basicSearch = await this.ensureAdminBasicSearch();
    await basicSearch.waitFor({ state: "visible", timeout: 30000 });

    const advancedButton = this.page
      .locator('button.yw-toggle-advanced-search[title="Switch search mode"]:visible')
      .first();
    await advancedButton.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advancedButton.click());

    await quickSearch.waitFor({ state: "hidden", timeout: 30000 });
    await orderLabel.waitFor({ state: "visible", timeout: 30000 });
  }

  async searchAdminOrderAdvanced(orderCode) {
    await this.openAdvancedSearch();

    const advancedSearch = this.page.locator(".yw-advancedsearch:visible").first();
    await advancedSearch.waitFor({ state: "visible", timeout: 30000 });

    // In Jenkins/headless the first textbox in Advanced Search is the
    // read-only comparator combobox ("Contains"), not the Order Nr. value.
    // Anchor on the visible Order Nr. label and take the first editable text
    // input that follows it, which is the actual value field for that row.
    const orderLabel = advancedSearch
      .getByText("Order Nr.", { exact: true })
      .filter({ visible: true })
      .first();
    await orderLabel.waitFor({ state: "visible", timeout: 30000 });

    const orderField = orderLabel.locator(
      'xpath=following::input[@type="text" and not(@readonly) and not(@aria-readonly="true")][1]'
    );
    await orderField.waitFor({ state: "visible", timeout: 30000 });
    await expect(orderField).toBeEditable({ timeout: 30000 });
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
