import { expect } from "@playwright/test";
import MyAccountPage from "./MyAccountPage";

export default class MyOrdersPage extends MyAccountPage {
  async visibleOrderCode(orderCode) {
    const matches = await this.page.getByRole("main")
      .getByText(orderCode, { exact: false })
      .all();
    for (const match of matches) {
      if (await match.isVisible()) return match;
    }
    return null;
  }

  async openMyOrders() {
    await this.openRoute(this.routes.orders);
    await this.page.getByRole("heading", { name: /Mis pedidos|Pedidos|My Orders/i })
      .first().waitFor({ state: "visible", timeout: 30000 });
  }

  async waitForOrder(orderCode, { attempts = 12, intervalMs = 15000 } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const order = await this.visibleOrderCode(orderCode);
      if (order) {
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
    const { order } = await this.waitForOrder(orderCode);
    return order;
  }

  async openOrderDetails(orderCode) {
    const { order } = await this.waitForOrder(orderCode);
    const card = order.locator(
      "xpath=ancestor::*[.//button[normalize-space()='Ver detalles'] or .//a[normalize-space()='Ver detalles']][1]",
    );
    const details = card.getByRole("link", { name: /Ver detalles|View details/i })
      .or(card.getByRole("button", { name: /Ver detalles|View details/i }))
      .first();
    await details.waitFor({ state: "visible", timeout: 30000 });
    await details.click();
    this.assertStagingUrl();
    await expect(this.page.getByRole("main").getByText(orderCode, { exact: false }).last()).toBeVisible();
  }

  async validateOrderDetails(orderCode, { sku, status = /En proceso|Processing/i } = {}) {
    const main = this.page.getByRole("main");
    await expect(main.getByText(orderCode, { exact: false }).last()).toBeVisible();
    await expect(main.getByText(status).first()).toBeVisible();
    if (sku) await expect(main.getByText(sku, { exact: false }).first()).toBeVisible();
    await expect(main.getByText(/S\/\s*[\d,.]+/).first()).toBeVisible();
  }
}
