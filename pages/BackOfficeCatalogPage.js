import { expect } from "@playwright/test";
import BackOfficePage from "./BackOfficePage";

export default class BackOfficeCatalogPage extends BackOfficePage {
  async waitForZkUpdate(action) {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/zkau(?:\/|$)/.test(new URL(response.url()).pathname),
      { timeout: 30000 }
    );
    await action();
    await responsePromise;
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, {
      timeout: 30000,
    });
  }

  async openAdminProducts() {
    const catalogRow = this.page
      .getByRole("row", { name: /^Catalog(?: selected)?$/i })
      .filter({ visible: true })
      .first();
    await catalogRow.waitFor({ state: "visible", timeout: 30000 });

    const productRow = this.page.getByRole("row", { name: /^Products?(?: selected)?$/i });
    if (!(await productRow.isVisible().catch(() => false))) {
      const expand = catalogRow.getByTitle("Expand", { exact: true });
      await expand.waitFor({ state: "visible", timeout: 30000 });
      await expand.click();
    }
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
    const quickSearch = this.page
      .getByPlaceholder("Type to search", { exact: true })
      .filter({ visible: true })
      .last();
    const advanced = this.page
      .locator('button.yw-toggle-advanced-search[title="Switch search mode"]:visible')
      .first();
    await advanced.waitFor({ state: "visible", timeout: 30000 });
    await this.waitForZkUpdate(() => advanced.click());
    await this.page.locator(".yw-advancedsearch:visible").first().waitFor({
      state: "visible",
      timeout: 30000,
    });
  }

  async searchAdminProductAdvanced(productCode) {
    await this.openAdvancedSearch();

    const field = this.page
      .getByRole("row")
      .filter({ has: this.page.getByText("Article Number", { exact: true }) })
      .filter({ visible: true })
      .first()
      .getByRole("textbox")
      .filter({ visible: true })
      .last();
    await field.waitFor({ state: "visible", timeout: 30000 });
    await field.fill(productCode);

    const searchButton = this.page
      .getByRole("button", { name: "Search", exact: true })
      .filter({ visible: true })
      .last();
    await this.waitForZkUpdate(() => searchButton.click());

    const code = this.page.getByText(productCode, { exact: true }).filter({ visible: true });
    await expect(code.first()).toBeVisible({ timeout: 30000 });
    return code.first();
  }
}
