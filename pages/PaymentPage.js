import BasePage from "./BasePage";

export default class PaymentPage extends BasePage {
  constructor(page) {
    super(page);

    this.creditCardOption = page.getByRole("button", {
      name: /Tarjeta de Crédito \/ Débito/i,
    });

    this.cardNumberInput = page.locator("#cardNumber");
    this.cardHolderInput = page.locator("#cardholderName");
    this.expiryInput = page.locator("#expiryDate");
    this.cvvInput = page.locator("#securityCode");

    this.installmentsSelect = page.locator("select").filter({
      hasText: /cuota|sin intereses|mensual/i,
    });

    this.placeOrderButton = page.getByRole("button", {
      name: /realizar pedido|pagar|finalizar compra/i,
    });
  }

  async selectCreditCard() {
    await this.creditCardOption.click();
    await this.cardNumberInput.waitFor({ state: "visible", timeout: 30000 });
    await this.screenshot("09-credit-card-selected");
  }

  async fillCardData(card) {
  await this.cardNumberInput.fill(card.number);
  await this.cardHolderInput.fill(card.holderName);
  await this.expiryInput.fill(card.expiry);
  await this.cvvInput.fill(card.cvv);

  await this.screenshot("10-card-data-filled");
}

  async placeOrder() {
    await this.placeOrderButton.scrollIntoViewIfNeeded();
    await this.placeOrderButton.click();
    await this.screenshot("11-place-order");
  }
}