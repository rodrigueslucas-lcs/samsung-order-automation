import BackOfficePage from "./BackOfficePage";

export default class BackOfficeOrderPage extends BackOfficePage {
  get agentOrderGrid() {
    return this.page
      .locator('[role="columnheader"]:visible')
      .filter({ hasText: "Customer Order Status" })
      .last()
      .locator("xpath=ancestor::*[@role='grid'][1]");
  }

  get agentOrderListView() {
    return this.agentOrderGrid.locator(
      "xpath=ancestor::*[.//nav[contains(@class,'z-paging')]][1]"
    );
  }

  get agentOrderPager() {
    return this.agentOrderListView.locator("nav.z-paging:visible");
  }

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
      .getByRole("row", { name: /^Order-Enhanced(?: selected)?$/ })
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

  async readVisibleAdminOrders() {
    const rows = this.page.locator(
      '[role="row"][aria-label*="Order Nr.:"]:visible'
    );
    await rows.first().waitFor({ state: "visible", timeout: 30000 });
    const labels = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label") || "")
    );
    return labels.map((label) => ({
      orderCode: label.match(/Order Nr\.: ([^,]+)/)?.[1]?.trim() || null,
      status:
        label.match(/(?:Status|Order Status): ([^,]+)/i)?.[1]?.trim() || null,
      label,
    }));
  }

  async openFirstAdminOrderAndReadStatus() {
    const orders = await this.readVisibleAdminOrders();
    const order = orders.find((candidate) => candidate.orderCode);
    if (!order) throw new Error("No readable Admin order row was available.");

    const row = this.page.getByRole("row", {
      name: new RegExp(`Order Nr\\.: ${this.escapeRegExp(order.orderCode)}(?:,|$)`),
    });
    await row.click();
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, {
      timeout: 30000,
    });

    const status = await this.readOpenAdminOrderStatus();
    return { orderCode: order.orderCode, status };
  }

  async readOpenAdminOrderStatus() {
    const statusControl = this.page
      .getByRole("button", {
        name: /^(created|processing|completed|shipped|cancelled|waiting for send financial|order split|shipping requested|temporary[_ ]\w+)$/i,
      })
      .filter({ visible: true })
      .last();
    await statusControl.waitFor({ state: "visible", timeout: 30000 });
    const status = (await statusControl.innerText()).replace(/\s+/g, " ").trim();
    if (!status) {
      throw new Error("The opened Admin order had an empty Status control.");
    }
    return status;
  }

  async scanVisibleAdminOrderStatuses({ limit = 50 } = {}) {
    const orders = (await this.readVisibleAdminOrders())
      .filter((order) => order.orderCode)
      .slice(0, limit);
    const inspected = [];

    for (const order of orders) {
      await this.searchAdminOrder(order.orderCode);
      const row = this.page.getByRole("row", {
        name: new RegExp(`Order Nr\\.: ${this.escapeRegExp(order.orderCode)}(?:,|$)`),
      });
      await row.click();
      await this.page.waitForFunction(() => !window.zk || !zk.processing, null, {
        timeout: 30000,
      });
      const status = await this.readOpenAdminOrderStatus();
      inspected.push({ orderCode: order.orderCode, status });

      await this.openTreeRow("Orders");
      await this.page
        .getByPlaceholder("Type to search", { exact: true })
        .last()
        .waitFor({ state: "visible", timeout: 30000 });
    }

    return inspected;
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

  async openAgentOrderBySearch(order) {
    const row = await this.searchAgentOrder(order.orderCode);
    await row.click();
    this.currentOrder = order;
    return order;
  }

  parseAgentOrderLabel(label) {
    const value = label || "";
    return {
      orderCode: value.match(/Order Number: ([^,]+)/)?.[1] || null,
      customerStatus:
        value.match(/Customer Order Status: ([^,]+)/)?.[1] || null,
      hybrisStatus: value.match(/Hybris Status: ([^,]+)/)?.[1] || null,
      nerpInterfaceId: value.match(/NERP Interface Id: ([^,]+)/)?.[1]?.trim() || null,
      responseMessage: value.match(/Response message: ([^,]+)/)?.[1]?.trim() || null,
      label: value,
    };
  }

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

  async resetAgentOrderPager() {
    const first = this.agentOrderPager.locator(
      'button[title="First Page"]:visible:not([disabled])'
    );
    if (await first.count()) {
      await this.waitForZkUpdate(() => first.click());
    }
  }

  async readVisibleAgentOrders() {
    const labels = await this.agentOrderGrid
      .locator('[role="row"][aria-label*="Order Number:"]:visible')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label")));
    return labels.map((label) => this.parseAgentOrderLabel(label));
  }

  async waitForAgentOrderRowsToChange(previousSignature, action) {
    await this.waitForZkUpdate(action);
    await this.page.waitForFunction(
      ({ previous }) => {
        const header = [...document.querySelectorAll('[role="columnheader"]')]
          .filter((element) => element.offsetParent !== null)
          .find((element) => element.textContent?.includes("Customer Order Status"));
        const grid = header?.closest('[role="grid"]');
        const signature = [...(grid?.querySelectorAll('[role="row"][aria-label*="Order Number:"]') || [])]
          .filter((element) => element.offsetParent !== null)
          .map((element) => element.getAttribute("aria-label")?.match(/Order Number: ([^,]+)/)?.[1] || "")
          .join("|");
        return signature && signature !== previous;
      },
      { previous: previousSignature },
      { timeout: 30000 }
    );
  }

  async findOrderAcrossPages(predicate) {
    await this.resetAgentOrderPager();
    const visited = new Set();

    for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
      const orders = await this.readVisibleAgentOrders();
      const signature = orders.map((order) => order.orderCode).join("|");
      if (visited.has(signature)) {
        throw new Error(`Order pager repeated page data at page ${pageNumber}.`);
      }
      visited.add(signature);

      const match = orders.find(predicate);
      if (match) return { ...match, pageNumber };

      const next = this.agentOrderPager.locator(
        'button[title="Next Page"]:not([disabled])'
      );
      if (!(await next.count())) return null;
      await this.waitForAgentOrderRowsToChange(signature, () => next.click());
    }

    throw new Error("Order pagination exceeded the 20-page safety limit.");
  }

  async readOrdersAcrossPages() {
    await this.resetAgentOrderPager();
    const visited = new Set();
    const uniqueOrders = new Map();

    for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
      const orders = await this.readVisibleAgentOrders();
      const signature = orders.map((order) => order.orderCode).join("|");
      if (visited.has(signature)) break;
      visited.add(signature);
      for (const order of orders) {
        if (order.orderCode) uniqueOrders.set(order.orderCode, order);
      }

      const next = this.agentOrderPager.locator(
        'button[title="Next Page"]:not([disabled])'
      );
      if (!(await next.count())) return [...uniqueOrders.values()];
      await this.waitForAgentOrderRowsToChange(signature, () => next.click());
    }

    if (visited.size >= 20) {
      throw new Error("Order pagination exceeded the 20-page safety limit.");
    }
    return [...uniqueOrders.values()];
  }

  async findOrderByHybrisStatus(status) {
    return this.findOrderAcrossPages((order) => order.hybrisStatus === status);
  }

  async openOrderByCode(orderCode) {
    const order = await this.findOrderAcrossPages(
      (candidate) => candidate.orderCode === orderCode
    );
    if (!order) throw new Error(`Order not found across pages: ${orderCode}`);
    const row = this.agentOrderGrid.getByRole("row", {
      name: new RegExp(`Order Number: ${this.escapeRegExp(orderCode)}(?:,|$)`),
    });
    await row.click();
    this.currentOrder = order;
    return order;
  }

  async readCustomerStatus() {
    if (!this.currentOrder) throw new Error("No current order is selected.");
    return this.currentOrder.customerStatus;
  }

  async readHybrisStatus() {
    if (!this.currentOrder) throw new Error("No current order is selected.");
    return this.currentOrder.hybrisStatus;
  }

  async findOrOpenOrderByHybrisStatus(status, fallbackOrderCode) {
    const match = await this.findOrderByHybrisStatus(status);
    const orderCode = match?.orderCode || fallbackOrderCode;
    if (!orderCode) {
      throw new Error(`No order found with Hybris status: ${status}`);
    }
    if (!match) return this.openOrderByCode(orderCode);
    const row = this.agentOrderGrid.getByRole("row", {
      name: new RegExp(`Order Number: ${this.escapeRegExp(orderCode)}(?:,|$)`),
    });
    await row.click();
    this.currentOrder = match;
    return match;
  }

  async refreshAndReadOrderStatus(orderCode) {
    await this.page
      .getByRole("row", { name: /^Order-Enhanced(?: selected)?$/ })
      .click();
    await this.expectAgentOrders();
    return this.openOrderByCode(orderCode);
  }

  async findCancellationCandidates({
    excludedCodes = [],
    excludedStatuses = [],
    allowedStatuses = null,
  } = {}) {
    const codes = new Set(excludedCodes);
    const statuses = new Set(excludedStatuses);
    const orders = await this.readOrdersAcrossPages();
    return orders.filter(
      (order) =>
        !codes.has(order.orderCode) &&
        !statuses.has(order.hybrisStatus) &&
        (!allowedStatuses || allowedStatuses.includes(order.hybrisStatus)) &&
        order.hybrisStatus !== "Cancelled"
    );
  }

  async openCancelEditor() {
    const cancel = this.page.getByText("Cancel", { exact: true }).filter({
      visible: true,
    });
    await cancel.last().waitFor({ state: "visible", timeout: 30000 });
    await cancel.last().click();
    await this.page
      .getByText("Cancellation and Return", { exact: true })
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async inspectCancellationControls() {
    const sections = ["Cancellation and Return", "SMC Only Cancellation"];
    const result = [];
    for (const name of sections) {
      const label = this.page.getByText(name, { exact: true });
      if (!(await label.isVisible().catch(() => false))) continue;
      const container = label.locator(
        "xpath=ancestor::*[.//input or .//select or .//textarea][1]"
      );
      const controls = container.locator("input, select, textarea");
      for (let index = 0; index < (await controls.count()); index += 1) {
        const control = controls.nth(index);
        if (!(await control.isVisible().catch(() => false))) continue;
        result.push({
          section: name,
          tag: await control.evaluate((element) => element.tagName.toLowerCase()),
          type: await control.getAttribute("type"),
          name: await control.getAttribute("name"),
          disabled: await control.isDisabled(),
          readOnly: (await control.getAttribute("readonly")) !== null,
          required:
            (await control.getAttribute("required")) !== null ||
            (await control.getAttribute("aria-required")) === "true",
        });
      }
    }
    return result;
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
