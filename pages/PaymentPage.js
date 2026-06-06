import BasePage from './BasePage';

export default class PaymentPage extends BasePage {
  constructor(page) {
    super(page);

    this.creditCardOption = page.getByText(/tarjeta de crédito/i);
    this.placeOrderButton = page.getByRole('button');
  }

  async selectCreditCard() {
    await this.creditCardOption.click();
    await this.screenshot('09-credit-card-selected');
  }

  async fillCardData(card) {
    // locator será ajustado quando ambiente voltar

    await this.screenshot('10-card-data-filled');
  }

  async placeOrder() {
    await this.placeOrderButton.click();
    await this.screenshot('11-place-order');
  }
}