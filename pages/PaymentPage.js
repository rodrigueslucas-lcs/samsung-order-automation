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

    await this.cardHolderInput.waitFor({ state: "visible", timeout: 60000 });

    await this.screenshot("09-credit-card-selected");
  }

  async fillCardData(card) {
    await this.typeInMercadoPagoFrame(
      'iframe[name="cardNumber"]',
      "#cardNumber",
      card.number
    );

    await this.cardHolderInput.fill("");
    await this.cardHolderInput.pressSequentially(card.holderName, { delay: 50 });

    await this.typeInMercadoPagoFrame(
      'iframe[name="expirationDate"]',
      "#expirationDate",
      card.expiry
    );

    await this.typeInMercadoPagoFrame(
      'iframe[name="securityCode"]',
      "#securityCode",
      card.cvv
    );

    await this.selectInstallments();

    await this.screenshot("10-card-data-filled");
  }

  async typeInMercadoPagoFrame(frameSelector, inputSelector, value) {
    const input = this.page.frameLocator(frameSelector).locator(inputSelector);

    await input.waitFor({ state: "visible", timeout: 60000 });
    await input.click();
    await input.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await input.press("Backspace");
    await input.pressSequentially(value, { delay: 80 });
    await input.press("Tab");
  }

  async selectInstallments() {
    await this.installmentsCombobox.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.installmentsCombobox.selectOption({ index: 0 }).catch(async () => {
      await this.installmentsCombobox.click();
      await this.page.keyboard.press("ArrowDown");
      await this.page.keyboard.press("Enter");
    });
  }

  async placeOrder() {
  await this.placeOrderButton.scrollIntoViewIfNeeded();

  await this.page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")]
      .find((btn) => /realizar pedido/i.test(btn.innerText));

    return button && !button.disabled;
  }, { timeout: 90000 });

  await this.screenshot("11-before-place-order");

  await this.placeOrderButton.click();

  const result = await Promise.race([
    this.page.waitForURL(
      /confirmation|confirmacion|order-confirmation|checkout\/order|success/i,
      { timeout: 90000 }
    ).then(() => "CONFIRMATION"),

    this.page
      .getByText(/error|rechazad|intenta|no pudimos|problema|inválid/i)
      .first()
      .waitFor({ state: "visible", timeout: 90000 })
      .then(() => "ERROR_MESSAGE"),

    this.page.waitForTimeout(90000).then(() => "TIMEOUT"),
  ]);

  await this.screenshot(`11-after-place-order-${result.toLowerCase()}`);

  if (result !== "CONFIRMATION") {
    throw new Error(`Pedido não foi confirmado. Resultado após clicar: ${result}`);
  }
}
}