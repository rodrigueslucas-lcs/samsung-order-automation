import PaymentPage from './PaymentPage';
import destructiveGuards from '../utils/destructiveGuards';

const { requirePaymentSubmitOptIn } = destructiveGuards;

export default class MarketPaymentPage extends PaymentPage {
  constructor(page, marketProfile = {}) {
    super(page);
    this.marketProfile = marketProfile;
    this.externalMercadoPago = Boolean(marketProfile.externalMercadoPago);
  }

  async selectPaymentMode(name) {
    const paymentMethod = this.page.getByText(name, { exact: false }).filter({ visible: true }).first();
    await paymentMethod.waitFor({ state: 'visible', timeout: 60000 });
    await paymentMethod.click();
  }

  async externalCardField(name) {
    const deadline = Date.now() + 90000;
    do {
      for (const frame of this.page.frames()) {
        const field = frame.getByRole("textbox", { name }).first();
        if (await field.isVisible().catch(() => false)) return field;
      }
      await this.page.waitForTimeout(250);
    } while (Date.now() < deadline);
    throw new Error(`Mercado Pago card field was not visible: ${name}`);
  }

  async fillExternalCreditCard(card) {
    if (!this.externalMercadoPago) return super.fillCreditCard(card);

    const number = await this.externalCardField(/N[uú]mero de tarjeta/i);
    const holder = await this.externalCardField(/Nombre del titular/i);
    const expiry = await this.externalCardField(/Vencimiento/i);
    const cvv = await this.externalCardField(/C[oó]digo de seguridad/i);

    await number.fill(card.number);
    await holder.fill(card.holderName);
    await expiry.fill(card.expiry);
    await cvv.fill(card.cvv);
  }

  async validateCreditCardReady(card) {
    if (!this.externalMercadoPago) return super.validateCreditCardReady(card);
    const digits = (value) => value.replace(/\D/g, "");
    const fields = {
      number: await this.externalCardField(/N[uú]mero de tarjeta/i),
      holder: await this.externalCardField(/Nombre del titular/i),
      expiry: await this.externalCardField(/Vencimiento/i),
      cvv: await this.externalCardField(/C[oó]digo de seguridad/i),
    };
    if (digits(await fields.number.inputValue()) !== digits(card.number)) throw new Error("Mercado Pago external form did not retain the card number.");
    if ((await fields.holder.inputValue()).trim() !== card.holderName) throw new Error("Mercado Pago external form did not retain the holder name.");
    if (digits(await fields.expiry.inputValue()) !== digits(card.expiry)) throw new Error("Mercado Pago external form did not retain the expiry.");

    // CVV is a secure gateway field. Mercado Pago can clear, mask or transform
    // the value after tokenization/blur. Reading it back is not a reliable
    // business assertion and can expose gateway-specific representation. Treat
    // the gateway validation state + enabled Continue action as the proof that
    // the configured security code was accepted.
    if ((await fields.cvv.getAttribute("aria-invalid")) === "true") {
      throw new Error("Mercado Pago rejected the configured security code.");
    }

    await fields.cvv.blur();
    await this.page.waitForTimeout(500);

    const continueButton = this.page.getByRole("button", { name: /^Continuar$/i });
    await continueButton.waitFor({ state: "visible", timeout: 30000 });
    if (!(await continueButton.isEnabled())) throw new Error("Mercado Pago Continue remained disabled after valid test-card data.");
  }

  async placeExternalMercadoPagoOrder({ orderCodePattern = this.marketProfile.orderCodePattern } = {}) {
    requirePaymentSubmitOptIn();

    const continueButton = this.page
      .getByRole("button", { name: /^Continuar$/i })
      .filter({ visible: true })
      .last();

    await continueButton.waitFor({ state: "visible", timeout: 30000 });
    await continueButton.scrollIntoViewIfNeeded();

    if (!(await continueButton.isEnabled())) {
      throw new Error("Mercado Pago Continue is visible but disabled after card data was filled.");
    }

    const cvvField = await this.externalCardField(/C[oó]digo de seguridad/i);
    if ((await cvvField.getAttribute("aria-invalid")) === "true") {
      throw new Error("Mercado Pago security code is explicitly invalid before order submission.");
    }

    await continueButton.click();
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});

    const orderCode = this.page.getByText(orderCodePattern).filter({ visible: true }).first();
    await orderCode.waitFor({ state: "visible", timeout: 90000 });
    return (await orderCode.textContent())?.match(orderCodePattern)?.[0] || null;
  }
}
