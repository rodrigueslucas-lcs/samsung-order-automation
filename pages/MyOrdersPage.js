import { expect } from "@playwright/test";
import ProfilePage from "./ProfilePage";

export default class MyOrdersPage extends ProfilePage {
  async openMyOrders() {
    await this.openProfile();
    const entry = this.page.getByRole("menuitem", { name: /Mis pedidos|My Orders/i })
      .or(this.page.getByRole("link", { name: /Mis pedidos|My Orders/i }))
      .first();
    await entry.waitFor({ state: "visible", timeout: 30000 });
    await entry.click();
    await this.page.getByRole("heading", { name: /Mis pedidos|Pedidos|My Orders/i })
      .first().waitFor({ state: "visible", timeout: 30000 });
  }

  async waitForOrder(orderCode, { attempts = 12, intervalMs = 15000 } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const order = this.page.getByText(orderCode, { exact: false }).first();
      if (await order.isVisible()) {
        return { order, attempt, elapsedMs: (attempt - 1) * intervalMs };
      }
      if (attempt < attempts) {
        await this.page.waitForTimeout(intervalMs);
        await this.page.reload({ waitUntil: "domcontentloaded" });
      }
    }
    throw new Error(`Authenticated order ${orderCode} did not appear in My Orders.`);
  }

  async findOrder(orderCode) {
    await this.openMyOrders();
    const order = this.page.getByText(orderCode, { exact: false }).first();
    await expect(order).toBeVisible();
    return order;
  }

  async openOrderDetails(orderCode) {
    const { order } = await this.waitForOrder(orderCode);
    await order.click();
    await expect(this.page.getByText(orderCode, { exact: false }).first()).toBeVisible();
  }

  async validateOrderDetails(orderCode, { sku } = {}) {
    await expect(this.page.getByText(orderCode, { exact: false }).first()).toBeVisible();
    await expect(this.page.getByText(/Estado|Status/i).first()).toBeVisible();
    if (sku) await expect(this.page.getByText(sku, { exact: false }).first()).toBeVisible();
    await expect(this.page.getByText(/S\/\s*[\d,.]+/).first()).toBeVisible();
  }
}
