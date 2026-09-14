import { expect } from "@playwright/test";
import BackOfficePage from "./BackOfficePage";

export default class BackOfficeCatalogPage extends BackOfficePage {
  async openAdminProducts() {
    const catalogRow = this.page.getByRole("row", { name: /^Catalog(?: selected)?$/i });
    if (await catalogRow.isVisible().catch(() => false)) await catalogRow.click();

    const productRow = this.page.getByRole("row", { name: /^Products?(?: selected)?$/i });
    await productRow.waitFor({ state: "visible", timeout: 30000 });
    await productRow.click();

    await this.page
      .getByPlaceholder("Type to search", { exact: true })
      .last()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async searchAdminProductBasic(productCode) {
    const searchInput = this.page
      .getByPlaceholder("Type to search", { exact: true })
      .last();
    await searchInput.fill(productCode);
    const toolbar = searchInput.locator("xpath=../..");
    await this.waitForZkUpdate(() => toolbar.locator('button[title="Search"]').click());

    const code = this.page.getByText(productCode, { exact: true }).filter({ visible: true });
    await code.first().waitFor({ state: "visible", timeout: 30000 });
    return code.first();
  }

  async openAdvancedSearch() {
    const advanced = this.page
      .getByRole("button", { name: /Advanced Search|Advanced search/i })
      .or(this.page.locator('button[title*="Advanced" i]'))
      .filter({ visible: true })
      .first();
    await advanced.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advanced.click());
  }

  async searchAdminProductAdvanced(productCode) {
    await this.openAdvancedSearch();

    const field = this.page
      .getByRole("textbox", { name: /Code|Product Code|SKU/i })
      .or(this.page.locator('input[placeholder*="code" i]'))
      .filter({ visible: true })
      .first();
    await field.waitFor({ state: "visible", timeout: 30000 });
    await field.fill(productCode);

    const searchButton = this.page
      .getByRole("button", { name: /^Search$/i })
      .or(this.page.locator('button[title="Search"]'))
      .filter({ visible: true })
      .last();
    await this.waitForZkUpdate(() => searchButton.click());

    const code = this.page.getByText(productCode, { exact: true }).filter({ visible: true });
    await expect(code.first()).toBeVisible({ timeout: 30000 });
    return code.first();
  }
}
