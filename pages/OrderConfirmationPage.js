import { expect } from '@playwright/test';
import BasePage from './BasePage';

export default class OrderConfirmationPage extends BasePage {
  constructor(page) {
    super(page);

    this.successText = page.getByText(
      /gracias por tu compra|pedido confirmado|orden confirmada|compra realizada|order confirmed/i
    );

    this.orderNumberCandidate = page.locator('body');
  }

  async validateOrderCreated() {
    await this.page.waitForLoadState('domcontentloaded');

    await expect(this.page).toHaveURL(
      /confirmation|confirmacion|order-confirmation|checkout\/order|success/i,
      { timeout: 90000 }
    );

    await expect(this.successText.first()).toBeVisible({
      timeout: 60000
    });

    const bodyText = await this.orderNumberCandidate.innerText();

    const match = bodyText.match(
      /(número de pedido|número de orden|pedido|orden|order)\s*[:#]?\s*([0-9]{6,}|[A-Z0-9-]{8,})/i
    );

    if (!match?.[2]) {
      await this.screenshot('12-order-confirmation-no-order-number');
      throw new Error('Pedido confirmado, mas número do pedido não foi encontrado.');
    }

    const orderNumber = match[2];

    console.log(`Order Number => ${orderNumber}`);

    await this.screenshot('12-order-confirmation');
  }
}