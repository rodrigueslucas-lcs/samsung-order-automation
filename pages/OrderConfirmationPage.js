import BasePage from './BasePage';

export default class OrderConfirmationPage extends BasePage {
  constructor(page) {
    super(page);
  }

  async validateOrderCreated() {
    await this.waitForPageLoad();

    await this.screenshot('12-order-confirmation');
  }
}