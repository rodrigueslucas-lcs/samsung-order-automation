import BackOfficePage from "./BackOfficePage";

export default class BackOfficeOrderPage extends BackOfficePage {
  async openAdminOrders() {
    await this.openTreeRow("Order");
    await this.openTreeRow("Orders");
    await this.page
      .getByText("Orders", { exact: true })
      .last()
      .waitFor({ state: "visible", timeout: 30000 });
    await this.page
      .getByPlaceholder("Type to search", { exact: true })
      .last()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async expectAgentOrders() {
    await this.page
      .getByRole("row", { name: "Order-Enhanced", exact: true })
      .waitFor({ state: "visible", timeout: 30000 });
    await this.page
      .getByPlaceholder("Search by order code, email, name, mobile", {
        exact: true,
      })
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async searchAdminOrder(orderCode) {
    const searchInput = this.page
      .getByPlaceholder("Type to search", { exact: true })
      .last();
    await searchInput.fill(orderCode);

    const searchToolbar = searchInput.locator("xpath=../..");
    await searchToolbar.locator('button[title="Search"]').click();

    const result = this.page.getByRole("row", {
      name: new RegExp(`Order Nr\\.: ${this.escapeRegExp(orderCode)}`),
    });
    await result.waitFor({ state: "visible", timeout: 30000 });
    return result;
  }

  async searchAgentOrder(orderCode) {
    const searchInput = this.page.getByPlaceholder(
      "Search by order code, email, name, mobile",
      { exact: true }
    );
    await searchInput.fill(orderCode);
    await searchInput.press("Enter");

    const result = this.page.getByRole("row", {
      name: new RegExp(`Order Number: ${this.escapeRegExp(orderCode)}`),
    });
    await result.waitFor({ state: "visible", timeout: 30000 });
    return result;
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
