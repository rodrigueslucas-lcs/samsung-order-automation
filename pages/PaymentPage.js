import BasePage from "./BasePage";

export default class PaymentPage extends BasePage {
  constructor(page) {
    super(page);

    this.creditCardOption = page.getByRole("button", {
      name: /Tarjeta de Crédito \/ Débito/i,
    });

    this.cardHolderInput = page.locator("#input-checkout__cardholderName");

    this.installmentsCombobox = page.getByRole("combobox", {
      name: /cuántas cuotas/i,
    });

    this.placeOrderButton = page.getByRole("button", {
      name: /realizar pedido/i,
    });
  }

  async selectCreditCard() {
    await this.creditCardOption.click();

    await this.page
      .frameLocator('iframe[name="cardNumber"]')
      .locator("#cardNumber")
      .waitFor({ state: "visible", timeout: 60000 });

    await this.cardHolderInput.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await this.screenshot("09-credit-card-selected");
  }

  async fillCardData(card) {
    console.log("Mercado Pago Card =>", card);

    await this.page
      .frameLocator('iframe[name="cardNumber"]')
      .locator("#cardNumber")
      .fill(card.number);

    await this.cardHolderInput.fill(card.holderName);

    await this.page
      .frameLocator('iframe[name="expirationDate"]')
      .locator("#expirationDate")
      .fill(card.expiry);

    await this.page
      .frameLocator('iframe[name="securityCode"]')
      .locator("#securityCode")
      .fill(card.cvv);

    await this.selectInstallments();

    await this.placeOrderButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("10-card-data-filled");
  }

  async selectInstallments() {
    await this.installmentsCombobox.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.installmentsCombobox.click();

    const option = this.page
      .getByRole("option")
      .filter({ hasText: /1|cuota|sin intereses/i })
      .first();

    if (await option.isVisible({ timeout: 10000 }).catch(() => false)) {
      await option.click();
    } else {
      await this.page.keyboard.press("ArrowDown");
      await this.page.keyboard.press("Enter");
    }
  }

  async placeOrder() {
    await this.placeOrderButton.scrollIntoViewIfNeeded();

    await this.placeOrderButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.placeOrderButton.click();

    await this.screenshot("11-place-order");
  }
}