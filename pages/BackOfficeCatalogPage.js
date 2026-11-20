import BackOfficePage from "./BackOfficePage";

export default class BackOfficeCatalogPage extends BackOfficePage {
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
    // The previous Orders toolbar remains visible while Products loads.
    // Do not fill/click that stale toolbar before the navigation AU finishes.
    await this.waitForZkUpdate(() => productRow.click());

    await this.page
      .getByPlaceholder("Type to search", { exact: true })
      .filter({ visible: true })
      .last()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async searchAdminProductBasic(productCode) {
    const searchInput = this.page
      .getByPlaceholder("Type to search", { exact: true })
      .filter({ visible: true })
      .last();
    await searchInput.fill(productCode);
    const toolbar = searchInput.locator("xpath=../..");
    return this.submitProductSearch(toolbar.locator('button[title="Search"]'), productCode);
  }

  async submitProductSearch(searchButton, productCode) {
    const eventTargetId = await searchButton.getAttribute("id");
    if (!eventTargetId) throw new Error("BackOffice product Search button has no ZK identity.");
    // Product thumbnails emit AU requests after navigation. Wait for this
    // button's onClick response, not the first image/size notification.
    await this.waitForZkUpdate(() => searchButton.click(), { timeout: 90000, eventTargetId });
    const code = this.page.getByText(productCode, { exact: true }).filter({ visible: true }).first();
    await code.waitFor({ state: "visible", timeout: 30000 }).catch(() => {
      throw new Error(`BackOffice product Search completed, but exact SKU ${productCode} was not rendered.`);
    });
    return code;
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
    return this.submitProductSearch(searchButton, productCode);
  }
}
