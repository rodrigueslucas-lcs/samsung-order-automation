import BasePage from "./BasePage";
import destructiveGuards from "../utils/destructiveGuards";

const { requirePaymentSubmitOptIn } = destructiveGuards;

export default class PaymentPage extends BasePage {
  constructor(page) {
    super(page);

    this.creditCardOption = page.getByRole("button", {
      name: /Tarjeta de Crédito \/ Débito/i,
    });

    this.cardHolderInput = page.locator("#input-checkout__cardholderName");

    this.installmentsCombobox = page.getByRole("combobox", {
      name: /cuántas cuotas|Mensualidades/i,
    });

    this.placeOrderButton = page
      .getByRole("button", { name: /realizar pedido|pagar ahora/i })
      .filter({ visible: true });
  }

  async validatePaymentPage({
    expectedPaymentMode = /Tarjeta de Crédito \/ Débito/i,
  } = {}) {
    await this.page.waitForURL(/CHECKOUT_STEP_PAYMENT/, {
      timeout: 90000,
    });

    await this.page.getByRole("button", { name: expectedPaymentMode }).waitFor({
      state: "visible",
      timeout: 90000,
    });

    await this.screenshot("09-payment-page");
  }

  async validatePriceBreakdown() {
    const orderSummary = this.page.getByRole("heading", {
      name: /Resumen de la orden/i,
    });

    const orderSummarySection = this.page
      .getByRole("heading", { name: /Resumen de la orden/i })
      .locator("..");

    const subtotalLabel = orderSummarySection
      .getByText("Subtotal", { exact: true })
      .first();

    const totalHeading = this.page.getByRole("heading", {
      name: /^Total$/i,
    });

    await orderSummary.waitFor({
      state: "visible",
      timeout: 90000,
    });

    await subtotalLabel.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await totalHeading.waitFor({
      state: "visible",
      timeout: 30000,
    });

    const subtotalContainer = subtotalLabel.locator("..");
    const totalContainer = totalHeading.locator("..");

    const subtotalText = await subtotalContainer.textContent();
    const totalText = await totalContainer.textContent();

    const subtotal = subtotalText?.match(/S\/\s*[\d,.]+/)?.[0];
    const total = totalText?.match(/S\/\s*[\d,.]+/)?.[0];

    if (!subtotal) {
      throw new Error("Subtotal value was not displayed on Payment Page.");
    }

    if (!total) {
      throw new Error("Total value was not displayed on Payment Page.");
    }

    await this.screenshot("09-payment-price-breakdown");
  }

  async validateShippingAndBillingAddress(address) {
    const deliverySummary = this.page
      .getByText(/Dirección de entrega/i)
      .first();

    await deliverySummary.waitFor({
      state: "visible",
      timeout: 90000,
    });

    const addressText = this.page.getByText(
      new RegExp(`${address.street}.*${address.number}`, "i")
    ).first();

    await addressText.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("09-payment-shipping-billing-address");
  }

  async validateAvailablePaymentModes() {
    const paymentModes = [
      this.page.getByRole("button", { name: /^Cuotéalo\b/i }),
      this.page.getByRole("button", {
        name: /^Tarjeta de Crédito \/ Débito/i,
      }),
      this.page.getByRole("button", {
        name: /^Banca por Internet\b/i,
      }),
      this.page.getByRole("button", {
        name: /^Pago Efectivo\b/i,
      }),
    ];

    for (const paymentMode of paymentModes) {
      await paymentMode.waitFor({
        state: "visible",
        timeout: 90000,
      });
    }

    await this.screenshot("09-payment-modes");
  }

  async selectPaymentMode(name, screenshotName) {
    const paymentMode = this.page.getByRole("button", {
      name,
    });

    await paymentMode.waitFor({ state: "visible", timeout: 90000 });
    await paymentMode.scrollIntoViewIfNeeded();
    await paymentMode.click();

    const expanded = await paymentMode.getAttribute("aria-expanded");
    if (expanded !== "true") {
      throw new Error(
        `Payment mode did not become selected. aria-expanded: ${expanded ?? "missing"}`
      );
    }

    await this.screenshot(screenshotName);

    return paymentMode;
  }

  async selectBancaPorInternet() {
    const paymentMode = await this.selectPaymentMode(
      /^Banca por Internet\b/i,
      "09-banca-por-internet-selected"
    );
    await this.validateControlledPaymentPanel(paymentMode, "Banca por Internet");
  }

  async selectPagoEfectivo() {
    const paymentMode = await this.selectPaymentMode(
      /^Pago Efectivo\b/i,
      "09-pago-efectivo-selected"
    );
    await this.validateControlledPaymentPanel(paymentMode, "Pago Efectivo");
  }

  async selectCuotealo() {
    const paymentMode = await this.selectPaymentMode(
      /^Cuotéalo\b/i,
      "09-cuotealo-selected"
    );
    await this.validateControlledPaymentPanel(paymentMode, "Cuotéalo");

    await this.screenshot("09-cuotealo-content");
  }

  async selectYape() {
    const paymentMode = await this.selectPaymentMode(
      /^Yape\b/i,
      "09-yape-selected"
    );
    await this.validateControlledPaymentPanel(paymentMode, "Yape");
  }

  async selectAcuotaz() {
    const paymentMode = await this.selectPaymentMode(
      /^Acuotaz\b/i,
      "09-acuotaz-selected"
    );
    await this.validateControlledPaymentPanel(paymentMode, "Acuotaz");
  }

  async availablePaymentModeNames() {
    return this.page
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.hasAttribute("aria-expanded"))
          .map((button) => button.textContent?.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      );
  }

  async isPaymentModeAvailable(name) {
    return this.page.getByRole("button", { name }).isVisible();
  }

  async submitSelectedPaymentMode() {
    requirePaymentSubmitOptIn();
    const panel = this.selectedPaymentPanel;
    if (!panel) {
      throw new Error("No validated payment panel is selected.");
    }
    const pageAction = this.page.getByRole("button", {
      name: /^Pagar Ahora/i,
    });
    const submitAction = pageAction;
    await submitAction.waitFor({ state: "visible", timeout: 30000 });
    if (await submitAction.isDisabled().catch(() => false)) {
      throw new Error("The selected payment action is disabled.");
    }

    const initialUrl = this.page.url();
    const responses = [];
    let responseOrderCode = null;
    const recordResponse = (response) => {
      if (/payment|checkout|order|placeorder|transaction/i.test(response.url())) {
        responses.push({
          method: response.request().method(),
          status: response.status(),
          endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
        });
        response.text().then((text) => {
          responseOrderCode ||= text.match(/\bPE\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || null;
        }).catch(() => {});
      }
    };
    this.page.on("response", recordResponse);

    const popupPromise = this.page.context().waitForEvent("page", {
      timeout: 90000,
    }).catch(() => null);

    await this.screenshot("11-before-alternative-payment-submit");
    await submitAction.click();

    const result = await Promise.race([
      this.page.waitForURL(
        /confirmation|confirmacion|order-confirmation|checkout\/order|success/i,
        { timeout: 90000 }
      ).then(() => ({ type: "CONFIRMATION", target: this.page })),
      this.page.waitForURL(
        (url) => url.href !== initialUrl && !/CHECKOUT_STEP_PAYMENT/i.test(url.href),
        { timeout: 90000 }
      ).then(() => ({ type: "REDIRECT", target: this.page })),
      popupPromise.then((popup) => popup && ({ type: "POPUP", target: popup })),
      this.page.getByText(/error|rechazad|no pudimos|problema|no disponible/i)
        .first()
        .waitFor({ state: "visible", timeout: 90000 })
        .then(() => ({ type: "ERROR_MESSAGE", target: this.page })),
      this.page.waitForTimeout(90000).then(() => ({ type: "TIMEOUT", target: this.page })),
    ]);

    this.page.off("response", recordResponse);
    const target = result?.target || this.page;
    await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
    const rawFinalUrl = target.url();
    const parsedFinalUrl = new URL(rawFinalUrl);
    const finalUrl = parsedFinalUrl.origin + parsedFinalUrl.pathname;
    const bodyText = await target.locator("body").innerText({ timeout: 15000 }).catch(() => "");
    const orderCode = bodyText.match(/\bPE\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || responseOrderCode;

    await this.screenshot(`11-alternative-payment-${result?.type?.toLowerCase() || "unknown"}`);

    return {
      type: result?.type || "UNKNOWN",
      finalUrl,
      orderCode,
      responses: responses.slice(-20),
    };
  }

  async validateControlledPaymentPanel(paymentMode, modeName) {
    const controlledPanelId = await paymentMode.getAttribute("aria-controls");
    if (!controlledPanelId) {
      throw new Error(`${modeName} did not expose its controlled payment panel.`);
    }

    const paymentPanel = this.page.locator(`[id="${controlledPanelId}"]`);
    await paymentPanel.waitFor({ state: "visible", timeout: 30000 });
    if (!(await paymentPanel.innerText()).trim()) {
      throw new Error(`${modeName} expanded, but its payment content was empty.`);
    }

    this.selectedPaymentPanel = paymentPanel;
    return paymentPanel;
  }

  async navigateBackToCart() {
    const editCartLink = this.page.locator('a[href="/pe/cart"]').first();

    await editCartLink.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await editCartLink.scrollIntoViewIfNeeded();

    await Promise.all([
      this.page.waitForURL(/\/pe\/cart/, {
        timeout: 60000,
      }),
      editCartLink.click(),
    ]);
  }

  async selectCreditCard() {
    await this.creditCardOption.click();

    if ((await this.creditCardOption.getAttribute("aria-expanded")) !== "true") {
      throw new Error("Credit/Debit Card did not become the selected payment mode.");
    }

    const newPaymentMethod = this.page.getByRole("radio", {
      name: "Nuevo método de pago",
      exact: true,
    });
    await newPaymentMethod.waitFor({ state: "visible", timeout: 30000 });
    if (!(await newPaymentMethod.isChecked())) {
      await this.page.locator(".overlay-spinner").waitFor({
        state: "hidden",
        timeout: 30000,
      });

      const cartReminderText = this.page
        .getByText(/Tus productos aún están disponibles\. Finaliza ahora/i)
        .filter({ visible: true });
      if (await cartReminderText.count()) {
        const cartReminder = cartReminderText.first().locator(
          "xpath=ancestor::*[.//*[normalize-space()='x']][1]"
        );
        const closeReminder = cartReminder.getByText("x", { exact: true });
        await closeReminder.click();
        await cartReminder.waitFor({ state: "hidden", timeout: 30000 });
      }

      const newPaymentMethodLabel = this.page
        .getByText("Nuevo método de pago", { exact: true })
        .filter({ visible: true });
      await newPaymentMethodLabel.waitFor({ state: "visible", timeout: 30000 });
      await newPaymentMethodLabel.scrollIntoViewIfNeeded();
      await newPaymentMethodLabel.click();
    }
    if (!(await newPaymentMethod.isChecked())) {
      throw new Error("Nuevo método de pago did not remain selected.");
    }

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

    if (card.document) {
      const documentInput = await this.cardDocumentInput();
      if (await documentInput.isVisible().catch(() => false)) {
        await documentInput.fill(card.document);
      }
    }

    await this.selectInstallments();

    const requiredSubscriptionTerms = this.page
      .getByRole("checkbox", {
        name: /Confirmo que he leído y acepto los t[eé]minos de la suscripci[oó]n SC\+ mensual/i,
      })
      .filter({ visible: true });
    if (await requiredSubscriptionTerms.count()) {
      if (!(await requiredSubscriptionTerms.first().isChecked())) {
        await requiredSubscriptionTerms.first().check();
      }
      if (!(await requiredSubscriptionTerms.first().isChecked())) {
        throw new Error("MX monthly SC+ subscription terms did not remain accepted.");
      }
    }

    await this.screenshot("10-card-data-filled");
  }

  async validateCreditCardReady(card) {
    const cardNumber = this.page
      .frameLocator('iframe[name="cardNumber"]')
      .locator("#cardNumber");
    const expirationDate = this.page
      .frameLocator('iframe[name="expirationDate"]')
      .locator("#expirationDate");
    const securityCode = this.page
      .frameLocator('iframe[name="securityCode"]')
      .locator("#securityCode");

    const digits = (value) => value.replace(/\D/g, "");
    const actualCardNumber = digits(await cardNumber.inputValue());
    const actualExpiry = digits(await expirationDate.inputValue());
    const actualSecurityCode = digits(await securityCode.inputValue());
    if (actualCardNumber !== digits(card.number)) {
      throw new Error("Mercado Pago did not retain the complete card number.");
    }
    if (actualExpiry !== digits(card.expiry)) {
      throw new Error("Mercado Pago did not retain the expected expiry.");
    }
    if (actualSecurityCode !== digits(card.cvv)) {
      throw new Error("Mercado Pago did not retain the complete security code.");
    }

    if ((await this.cardHolderInput.inputValue()).trim() !== card.holderName) {
      throw new Error("The cardholder name was not populated correctly.");
    }
    if (card.document) {
      const documentInput = await this.cardDocumentInput();
      if (
        (await documentInput.isVisible().catch(() => false)) &&
        digits(await documentInput.inputValue()) !== digits(card.document)
      ) {
        throw new Error("Mercado Pago did not retain the expected document number.");
      }
    }

    await this.placeOrderButton.waitFor({ state: "visible", timeout: 30000 });
    if (!(await this.placeOrderButton.isEnabled())) {
      throw new Error("Credit card data was filled, but Realizar pedido remained disabled.");
    }

    await this.screenshot("10-credit-card-ready-before-submit");
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

    const options = await this.installmentsCombobox.locator("option").evaluateAll((items) =>
      items
        .filter((option) => !option.disabled && option.value)
        .map((option) => option.value)
    );
    if (options.length) {
      await this.installmentsCombobox.selectOption(options[0]);
    } else {
      await this.installmentsCombobox.click();
      await this.page.keyboard.press("ArrowDown");
      await this.page.keyboard.press("Enter");
    }
  }

  async cardDocumentInput() {
    const semanticDocument = this.page.getByRole("textbox", {
      name: /documento|identificaci[oó]n/i,
    });
    if (await semanticDocument.first().isVisible().catch(() => false)) {
      return semanticDocument.first();
    }
    return this.page
      .locator('#input-checkout__identificationNumber, input[name="identificationNumber"]')
      .first();
  }

  async placeOrder() {
    requirePaymentSubmitOptIn();
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

  async placeOrderAndCapture({ orderCodePattern = /\bMX\d{6}-\d{8}(?:_\d+)?\b/i } = {}) {
    requirePaymentSubmitOptIn();
    await this.placeOrderButton.scrollIntoViewIfNeeded();
    await this.placeOrderButton.waitFor({ state: "visible", timeout: 30000 });
    if (!(await this.placeOrderButton.isEnabled())) {
      throw new Error("Realizar pedido remained disabled before the single authorized submit.");
    }

    const responses = [];
    const responseBodies = [];
    let resolveResponseOrderCode;
    const responseOrderCode = new Promise((resolve) => {
      resolveResponseOrderCode = resolve;
    });
    const recordResponse = (response) => {
      if (!/payment|checkout|order|placeorder|transaction/i.test(response.url())) return;
      responses.push({
        method: response.request().method(),
        status: response.status(),
        endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
      });
      const body = response.text().catch(() => "");
      responseBodies.push(body);
      body.then((text) => {
        const code = text.match(orderCodePattern)?.[0];
        if (code) resolveResponseOrderCode(code);
      });
    };
    this.page.on("response", recordResponse);

    await this.screenshot("11-before-mx-registered-card-submit");
    await this.placeOrderButton.click();

    const outcome = await Promise.race([
      this.page.waitForURL(/confirmation|confirmacion|order-confirmation|checkout\/order|success/i, {
        timeout: 120000,
      }).then(() => ({ type: "CONFIRMATION" })),
      this.page.waitForFunction(
        ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
        { source: orderCodePattern.source, flags: orderCodePattern.flags },
        { timeout: 120000 }
      ).then(() => ({ type: "ORDER_CODE" })),
      responseOrderCode.then((orderCode) => ({ type: "ORDER_CODE_RESPONSE", orderCode })),
      this.page.getByRole("alert")
        .filter({ hasText: /error|rechazad|no pudimos|problema|inv[aá]lid/i })
        .first()
        .waitFor({ state: "visible", timeout: 120000 })
        .then(() => ({ type: "ERROR_MESSAGE" })),
      this.page.waitForTimeout(120000).then(() => ({ type: "TIMEOUT" })),
    ]);

    this.page.off("response", recordResponse);
    const bodies = await Promise.all(responseBodies);
    let pageText = await this.page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
    let orderCode =
      outcome.orderCode ||
      pageText.match(orderCodePattern)?.[0] ||
      bodies.map((body) => body.match(orderCodePattern)?.[0]).find(Boolean) ||
      null;

    if (!orderCode && outcome.type === "CONFIRMATION") {
      await this.page.waitForFunction(
        ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
        { source: orderCodePattern.source, flags: orderCodePattern.flags },
        { timeout: 30000 }
      ).catch(() => {});
      pageText = await this.page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
      orderCode = pageText.match(orderCodePattern)?.[0] || null;
    }

    await this.screenshot(`11-after-mx-registered-card-${outcome.type.toLowerCase()}`);
    if (!orderCode) {
      throw new Error(
        `The single MX registered-card submit completed with ${outcome.type}, but no order number was observable. Do not retry blindly. Network evidence: ${JSON.stringify(responses.slice(-20))}`
      );
    }

    return {
      outcome: outcome.type,
      orderCode,
      finalUrl: new URL(this.page.url()).origin + new URL(this.page.url()).pathname,
      responses: responses.slice(-20),
    };
  }
}
