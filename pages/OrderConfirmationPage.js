import { expect } from '@playwright/test';
import BasePage from './BasePage';

export default class OrderConfirmationPage extends BasePage {
  constructor(page) {
    super(page);

    this.successMessage = page
      .getByText(/gracias|pedido|orden|compra|confirm/i)
      .first();

    this.orderNumber = page
      .locator('body')
      .getByText(/orden|pedido|order/i)
      .first();
  }

  async validateOrderCreated() {
    await this.page.waitForLoadState('domcontentloaded');

    await expect(this.page).toHaveURL(
      /confirmation|success|order|checkout/i,
      { timeout: 60000 }
    );

    await expect(this.successMessage).toBeVisible({
      timeout: 60000
    });

    await this.screenshot('12-order-confirmation');
  }
}