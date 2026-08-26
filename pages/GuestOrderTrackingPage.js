import BasePage from "./BasePage";

export default class GuestOrderTrackingPage extends BasePage {
  constructor(page) {
    super(page);

    this.form = page.locator("form").filter({
      hasText: "Ingrese su número de pedido y correo electrónico",
    });
    this.orderNumber = this.form.locator('input[type="text"]').first();
    this.email = this.form.locator('input[type="email"]');
    this.verificationCode = this.form.locator('input[type="text"]').nth(1);
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
    await this.page
      .getByRole("heading", { name: /Búsqueda de Pedidos|Pedidos/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 });
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

    return {
      method: response.request().method(),
      status: response.status(),
      accepted: response.ok(),
      endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
    };
  }
}
