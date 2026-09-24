import PaymentPage from "./PaymentPage";
import paymentMarketProfile from "../utils/paymentMarketProfile";
import destructiveGuards from "../utils/destructiveGuards";

const { getPaymentMarketProfile } = paymentMarketProfile;
const { requirePaymentSubmitOptIn } = destructiveGuards;

export default class MarketPaymentPage extends PaymentPage {
  constructor(page, { market } = {}) {
    super(page);
    this.marketProfile = getPaymentMarketProfile(market);
  }

  async navigateBackToCart() {
    const { cartPath } = this.marketProfile;
    const editCartLink = this.page.locator(`a[href="${cartPath}"]`).first();

    await editCartLink.waitFor({ state: "visible", timeout: 30000 });
    await editCartLink.scrollIntoViewIfNeeded();

    await Promise.all([
      this.page.waitForURL((url) => url.pathname === cartPath, { timeout: 60000 }),
      editCartLink.click(),
    ]);
  }

  async placeOrderAndCapture(options = {}) {
    if (this.externalMercadoPago) return this.placeExternalMercadoPagoOrder(options);
    const { orderCodePattern } = this.marketProfile;
    return super.placeOrderAndCapture({
      ...options,
      orderCodePattern: options.orderCodePattern || orderCodePattern,
    });
  }

  async selectCreditCard() {
    const directCard = this.creditCardOption.filter({ visible: true }).first();
    if (await directCard.isVisible().catch(() => false)) return super.selectCreditCard();

    const walletsHeading = this.page.getByRole("heading", { name: /^Billeteras digitales$/i }).filter({ visible: true }).first();
    const walletsMode = this.page.getByRole("button").filter({ has: walletsHeading }).first();
    await walletsMode.waitFor({ state: "visible", timeout: 90000 });
    if ((await walletsMode.getAttribute("aria-expanded")) !== "true") {
      await walletsMode.click();
      await this.page.waitForFunction(
        (element) => element.getAttribute("aria-expanded") === "true",
        await walletsMode.elementHandle(),
        { timeout: 30000 }
      );
    }

    const mercadoPagoHeading = this.page
      .getByRole("heading", {
        name: /^Mercado Pago \(Cr[eé]dito, D[eé]bito y Dinero en Cuenta\)$/i,
        exact: true,
      })
      .filter({ visible: true })
      .first();
    const mercadoPagoMode = this.page.getByRole("button").filter({ has: mercadoPagoHeading }).first();
    await mercadoPagoMode.waitFor({ state: "visible", timeout: 90000 });
    if ((await mercadoPagoMode.getAttribute("aria-expanded")) !== "true") {
      await mercadoPagoMode.click();
      await this.page.waitForFunction(
        (element) => element.getAttribute("aria-expanded") === "true",
        await mercadoPagoMode.elementHandle(),
        { timeout: 30000 }
      );
    }
    const redirect = this.page.getByRole("button", { name: /Ir a Mercado Pago/i }).filter({ visible: true }).first();
    await redirect.waitFor({ state: "visible", timeout: 60000 });
    await Promise.all([
      this.page.waitForURL((url) => /mercadopago\.com\.mx$/i.test(url.hostname), { timeout: 120000 }),
      redirect.click(),
    ]);

    const guestCardOption = this.page
      .getByRole("button", { name: /Tarjeta\s+Cr[eé]dito, d[eé]bito o prepaga/i })
      .filter({ visible: true })
      .first();
    const cardNumber = this.page.getByRole("textbox", { name: /N[uú]mero de tarjeta/i }).first();
    await Promise.race([
      guestCardOption.waitFor({ state: "visible", timeout: 90000 }),
      cardNumber.waitFor({ state: "visible", timeout: 90000 }),
    ]);
    if (await guestCardOption.isVisible().catch(() => false)) {
      await guestCardOption.click();
    }
    await this.page.getByText(/Completa los datos de tu tarjeta/i).waitFor({ state: "visible", timeout: 90000 });
    await this.externalCardField(/N[uú]mero de tarjeta/i);
    this.externalMercadoPago = true;
  }

  async fillCardData(card) {
    if (!this.externalMercadoPago) return super.fillCardData(card);
    const number = await this.externalCardField(/N[uú]mero de tarjeta/i);
    const holder = await this.externalCardField(/Nombre del titular/i);
    const expiry = await this.externalCardField(/Vencimiento/i);
    const cvv = await this.externalCardField(/C[oó]digo de seguridad/i);
    for (const [field, value] of [[number, card.number], [expiry, card.expiry], [cvv, card.cvv]]) {
      await field.fill("");
      await field.pressSequentially(value, { delay: 50 });
    }
    await holder.fill(card.holderName);
    await holder.click();
    if ((await cvv.getAttribute("aria-invalid")) === "true") {
      throw new Error("Mercado Pago rejected the configured security code before payment review.");
    }
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

    // CVV is a secure gateway field. Mercado Pago may intentionally clear or
    // mask it after tokenization/blur, so requiring inputValue() to retain the
    // secret creates a false failure. Reject only an explicit invalid state or
    // a visible non-empty value that contradicts the configured test CVV.
    const cvvValue = digits(await fields.cvv.inputValue());
    if (cvvValue && cvvValue !== digits(card.cvv)) {
      throw new Error("Mercado Pago security-code field contains an unexpected value.");
    }
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
    await cvvField.blur();
    await this.page.waitForTimeout(500);

    await continueButton.waitFor({ state: "visible", timeout: 30000 });

    if (!(await continueButton.isEnabled())) {
      throw new Error("Mercado Pago Continue is disabled after card validation.");
    }

    const reviewReached = async (timeout = 15000) => {
      try {
        await Promise.race([
          this.page.waitForURL(
            (url) => /\/review\//i.test(url.pathname),
            { timeout }
          ),
          this.page
            .getByText(/Revisa tu pago/i)
            .waitFor({ state: "visible", timeout }),
        ]);
        return true;
      } catch {
        return false;
      }
    };

    await continueButton.click({ timeout: 30000 });

    let advancedToReview = await reviewReached(8000);

    if (!advancedToReview) {
      const secondContinue = this.page
        .getByRole("button", { name: /^Continuar$/i })
        .filter({ visible: true })
        .last();

      await secondContinue.waitFor({ state: "visible", timeout: 15000 });

      if (!(await secondContinue.isEnabled())) {
        throw new Error("Mercado Pago Continue became disabled before the second controlled click.");
      }

      await secondContinue.click({ timeout: 30000 });
      advancedToReview = await reviewReached(15000);
    }

    if (!advancedToReview) {
      const fallbackButton = this.page
        .locator("button")
        .filter({ hasText: /^Continuar$/i })
        .filter({ visible: true })
        .last();

      await fallbackButton.evaluate((button) => button.click());
      advancedToReview = await reviewReached(30000);
    }

    if (!advancedToReview) {
      throw new Error(
        `Mercado Pago Continue was clicked twice but the review step did not open. Current URL: ${this.page.url()}`
      );
    }

    await this.page
      .getByText(/Revisa tu pago/i)
      .waitFor({ state: "visible", timeout: 30000 });

    const payButton = this.page
      .getByRole("button", { name: /^Pagar$/i })
      .filter({ visible: true })
      .last();

    await payButton.waitFor({ state: "visible", timeout: 90000 });
    await payButton.scrollIntoViewIfNeeded();

    if (!(await payButton.isEnabled())) {
      throw new Error("Mercado Pago Pay button is visible but disabled on the review step.");
    }

    await payButton.click({ timeout: 30000 });

    await this.page.waitForURL(
      (url) => url.hostname === "stg2.shop.samsung.com" && /\/mx\/orderConfirmation/i.test(url.pathname),
      { timeout: 180000 }
    );
    const outcome = "CONFIRMATION";

    await this.page.waitForFunction(
      ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
      { source: orderCodePattern.source, flags: orderCodePattern.flags },
      { timeout: 60000 }
    ).catch(() => null);

    const body = await this.page
      .locator("body")
      .innerText({ timeout: 30000 })
      .catch(() => "");

    const confirmationUrl = decodeURIComponent(this.page.url());
    const orderCode = confirmationUrl.match(/MX\d{6}-\d{8}(?:_\d+)?/i)?.[0] ||
      body.match(/MX\d{6}-\d{8}(?:_\d+)?/i)?.[0] ||
      body.match(orderCodePattern)?.[0] || null;

    if (!orderCode) {
      throw new Error(
        `MX S2 Mercado Pago reached the Samsung confirmation flow (${outcome}), but the order code was not rendered within 60s; do not retry blindly. Final URL: ${this.page.url()}`
      );
    }

    return {
      outcome,
      orderCode,
      finalUrl: new URL(this.page.url()).origin + new URL(this.page.url()).pathname,
      responses: [],
    };
  }
}