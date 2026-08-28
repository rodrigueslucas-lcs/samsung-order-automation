import BasePage from "./BasePage";

export default class GuestOrderTrackingPage extends BasePage {
  constructor(page) {
    super(page);

    this.form = page.locator("form").filter({
      has: page.getByRole("button", { name: /Enviar código|Reenviar Código/i }),
    });
    this.orderNumber = this.form.locator('input[type="text"]').first();
    this.email = this.form.locator('input[type="email"]');
    this.verificationCode = this.form.getByRole("textbox", {
      name: "Código de verificación",
      exact: true,
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

  async validateGuestTrackingForm() {
    await this.form.waitFor({ state: "visible", timeout: 60000 });

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
    // coupling TC13 to an existing order or sending mail to a real address.
    await this.orderNumber.fill("QA-NOT-A-REAL-ORDER");
    await this.email.fill("qa.invalid@example.invalid");

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/tokocommercewebservices\/v2\/pe\/guest\/sendOrderOtp$/i.test(
          new URL(response.url()).pathname
        ),
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

  async requestVerificationCode(orderNumber, email) {
    if (!orderNumber || !email) {
      throw new Error(
        "Guest order number and email must be supplied at runtime."
      );
    }

    await this.orderNumber.fill(orderNumber);
    await this.email.fill(email);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/tokocommercewebservices\/v2\/pe\/guest\/sendOrderOtp$/i.test(
          new URL(response.url()).pathname
        ),
      { timeout: 30000 }
    );

    await this.sendCodeButton.click();
    const response = await responsePromise;

    if (!response.ok()) {
      throw new Error(
        `Guest order OTP request was rejected with HTTP ${response.status()}.`
      );
    }

    await this.page
      .getByText(/Hemos enviado el c\u00f3digo de verificaci\u00f3n.*correo electr\u00f3nico/i)
      .waitFor({ state: "visible", timeout: 30000 });

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
    await this.page.getByRole("main").getByText(orderNumber, { exact: false })
      .first().waitFor({ state: "visible", timeout: 60000 });
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

    const statusPattern = /Recibido|Pagado|En proceso|Preparando env[i\u00ed]o|En camino|Entregado|Processing|Shipping/i;
    const status = card.getByText(statusPattern).first();
    await status.waitFor({ state: "visible", timeout: 30000 });
    const statusText = (await status.innerText()).trim();

    await this.screenshot("tc13-guest-order-tracking-card");
    await details.click();
    await main.getByText(orderNumber, { exact: false }).last()
      .waitFor({ state: "visible", timeout: 60000 });

    const tracking = main.getByText(statusPattern).first();
    await tracking.waitFor({ state: "visible", timeout: 30000 });
    const detailText = await main.innerText();
    const hasOrderSummary = /S\/\s*[\d,.]+/.test(detailText);
    const hasProduct = /RB45DG6300B1PE|Refrigeradora|producto/i.test(detailText);
    await this.screenshot("tc13-guest-order-tracking-details");

    return {
      status: statusText,
      hasOrderSummary,
      hasProduct,
    };
  }
}
