import BasePage from "./BasePage";

export default class GuestOrderTrackingPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.market = String(options.market || "pe").toLowerCase();
    this.currencyPattern = options.currencyPattern || /S\/\s*[\d,.]+/;
    this.productPattern = options.productPattern || /RB45DG6300B1PE|Refrigeradora|producto/i;

    this.form = page.locator("form").filter({
      has: page.getByRole("button", { name: /Enviar código|Reenviar Código/i }),
    });
    this.orderNumber = this.form.locator('input[type="text"]').first();
    this.email = this.form.locator('input[type="email"]');
    this.verificationCode = this.form.getByRole("textbox", {
      name: /Código de Verificación/i,
    });
    this.sendCodeButton = this.form.getByRole("button", {
      name: "Enviar código",
      exact: true,
    });
    this.searchButton = this.form.getByRole("button", {
      name: "Buscar",
      exact: true,
    });
  }

  isOtpEndpoint(response) {
    const pathname = new URL(response.url()).pathname;
    return response.request().method() === "POST" &&
      new RegExp(`/tokocommercewebservices/v2/${this.market}/guest/sendOrderOtp$`, "i").test(pathname);
  }

  async validateGuestTrackingForm() {
    let formReady = false;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      formReady = await this.form.waitFor({ state: "visible", timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      if (formReady) break;
      if (attempt === 1) {
        await this.page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      }
    }
    if (!formReady) {
      throw new Error("Guest Track Order form did not render after one controlled reload.");
    }

    for (const field of [this.orderNumber, this.email, this.verificationCode]) {
      await field.waitFor({ state: "visible" });
    }

    if ((await this.orderNumber.getAttribute("required")) === null) {
      throw new Error("Guest order number is not marked as required.");
    }
    if ((await this.email.getAttribute("required")) === null) {
      throw new Error("Guest order email is not marked as required.");
    }
    if ((await this.email.getAttribute("type")) !== "email") {
      throw new Error("Guest order email does not use native email validation.");
    }
    if (!(await this.searchButton.isDisabled())) {
      throw new Error("Guest order Search should be disabled before verification.");
    }
  }

  async validateRequiredAndEmailMessages() {
    await this.orderNumber.focus();
    await this.orderNumber.blur();
    await this.email.focus();
    await this.email.blur();

    await this.form
      .getByText("Por favor, ingrese un número de pedido válido", {
        exact: true,
      })
      .waitFor({ state: "visible" });
    await this.form
      .getByText("Por favor, ingrese el correo asociado al pedido", {
        exact: true,
      })
      .waitFor({ state: "visible" });

    await this.orderNumber.fill("INVALID-ORDER-FORMAT");
    await this.email.fill("invalid-email");
    await this.email.blur();
    await this.form
      .getByText("Por favor, ingrese el correo asociado al pedido", {
        exact: true,
      })
      .waitFor({ state: "visible" });
  }

  async validateInvalidVerificationRequest() {
    // Deliberately nonexistent data: validates the guest API contract without
    // coupling the form check to an existing order or sending mail to a real address.
    await this.orderNumber.fill("QA-NOT-A-REAL-ORDER");
    await this.email.fill("qa.invalid@example.invalid");

    const responsePromise = this.page.waitForResponse(
      (response) => this.isOtpEndpoint(response),
      { timeout: 30000 }
    );
    await this.sendCodeButton.click();
    const response = await responsePromise;

    if (response.status() !== 401) {
      throw new Error(
        `Invalid guest order OTP request returned HTTP ${response.status()}, expected 401.`
      );
    }
    if (!(await this.searchButton.isDisabled())) {
      throw new Error("Search became enabled without a valid verification code.");
    }

    return {
      method: response.request().method(),
      status: response.status(),
      endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
    };
  }

  async requestVerificationCode(orderNumber, email, { maxAttempts = 1, retryDelayMs = 15000 } = {}) {
    if (!orderNumber || !email) {
      throw new Error(
        "Guest order number and email must be supplied at runtime."
      );
    }

    await this.orderNumber.fill(orderNumber);
    await this.email.fill(email);

    let response;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const responsePromise = this.page.waitForResponse(
        (candidate) => this.isOtpEndpoint(candidate),
        { timeout: 30000 }
      );
      await this.sendCodeButton.click();
      response = await responsePromise;

      const responseBody = await response.text().catch(() => "");
      const requestBody = response.request().postData() || "";

      console.log("[mx-tracking-otp]", JSON.stringify({
        attempt,
        status: response.status(),
        endpoint: response.url(),
        requestBody,
        responseBody,
      }));

      if (response.ok()) break;
      if (response.status() !== 401 || attempt === maxAttempts) {
        throw new Error(
          `Guest order OTP request was rejected with HTTP ${response.status()} after ${attempt} attempt(s).`
        );
      }
      // A newly confirmed order can need a short backend indexing window
      // before guest tracking accepts the causal order/email pair.
      await this.page.waitForTimeout(retryDelayMs);
    }

    // MX currently confirms an accepted OTP request by switching the form to
    // its active verification state (code input + resend countdown). The old
    // transient toast is not consistently rendered.
    await this.verificationCode.waitFor({ state: "visible", timeout: 30000 });
    const resendButton = this.form.getByRole("button", { name: /Reenviar c[oó]digo/i });
    await resendButton.waitFor({ state: "visible", timeout: 30000 });
    if (!(await resendButton.isDisabled())) {
      throw new Error("OTP request returned success but the resend countdown was not active.");
    }

    return {
      method: response.request().method(),
      status: response.status(),
      accepted: response.ok(),
      endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
    };
  }

  async submitVerificationCode(otp, orderNumber) {
    if (!/^\d{6}$/.test(otp)) {
      throw new Error("Guest tracking OTP must contain exactly six digits.");
    }

    await this.verificationCode.fill(otp);
    await this.searchButton.waitFor({ state: "visible", timeout: 30000 });
    if (!(await this.searchButton.isEnabled())) {
      throw new Error("Guest order Search remained disabled after the OTP was filled.");
    }

    await this.searchButton.click();
    const trackedOrder = this.page.getByRole("main").getByText(orderNumber, { exact: false }).first();
    const notFound = this.page.getByText(/No hemos podido encontrar ning[uú]n pedido/i).first();
    const outcome = await Promise.race([
      trackedOrder.waitFor({ state: "visible", timeout: 60000 }).then(() => "order"),
      notFound.waitFor({ state: "visible", timeout: 60000 }).then(() => "not-found"),
    ]);
    if (outcome === "not-found") {
      throw new Error(
        `Guest Track Order accepted the OTP but could not find ${orderNumber} in the current BaseSite.`
      );
    }
  }

  async validateTrackedOrder(orderNumber) {
    const main = this.page.getByRole("main");
    const order = main.getByText(orderNumber, { exact: false }).first();
    await order.waitFor({ state: "visible", timeout: 60000 });

    const card = order.locator(
      "xpath=ancestor::*[.//button[normalize-space()='Ver detalles'] or .//a[normalize-space()='Ver detalles']][1]"
    );
    const details = card.getByRole("link", { name: /Ver detalles/i })
      .or(card.getByRole("button", { name: /Ver detalles/i })).first();
    await details.waitFor({ state: "visible", timeout: 30000 });

    const statusPattern = /Pedido Registrado|Recibido|Pagado|En proceso|Preparando env[i\u00ed]o|En camino|Entregado|Processing|Shipping/i;
    const status = card.getByText(statusPattern).first();
    await status.waitFor({ state: "visible", timeout: 30000 });
    const statusText = (await status.innerText()).trim();

    await this.screenshot("guest-order-tracking-card");
    await details.click();
    await main.getByText(orderNumber, { exact: false }).last()
      .waitFor({ state: "visible", timeout: 60000 });

    const tracking = main.getByText(statusPattern).first();
    await tracking.waitFor({ state: "visible", timeout: 30000 });
    const detailText = await main.innerText();
    const hasOrderSummary = this.currencyPattern.test(detailText);
    const hasProduct = this.productPattern.test(detailText);
    await this.screenshot("guest-order-tracking-details");

    return {
      status: statusText,
      hasOrderSummary,
      hasProduct,
    };
  }
}
