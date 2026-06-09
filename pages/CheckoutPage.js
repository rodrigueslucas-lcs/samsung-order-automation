import BasePage from "./BasePage";

export default class CheckoutPage extends BasePage {
  constructor(page) {
    super(page);

    this.firstNameInput = page.getByRole("textbox", { name: "firstName" });
    this.lastNameInput = page.getByRole("textbox", { name: "lastName" });
    this.phoneInput = page.getByRole("textbox", { name: "phone" });
    this.documentTypeSelect = page.getByRole("combobox", {
      name: "Tipo de documento",
    });
    this.documentNumberInput = page.getByRole("textbox", { name: "vatNumber" });

    this.customerContinueButton = page.getByRole("button", {
      name: /^continuar$/i,
    });

    this.paymentContinueButton = page.getByRole("button", {
      name: /continuar con los métodos de pago/i,
    });
  }

  async fillCustomerData(customer) {
    await this.page.waitForURL(/CHECKOUT_STEP_CONTACT_INFO/, {
      timeout: 30000,
    });

    await this.firstNameInput.fill(customer.firstName);
    await this.lastNameInput.fill(customer.lastName);
    await this.phoneInput.fill(customer.phone);

    await this.documentTypeSelect.click();
    await this.page.getByText(customer.documentType, { exact: true }).click();

    await this.documentNumberInput.fill(customer.documentNumber);

    await this.screenshot("04-customer-info");

    await Promise.all([
      this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 30000 }),
      this.customerContinueButton.click(),
    ]);

    await this.screenshot("05-delivery-step");
  }

  async fillAddress(address) {
  await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 30000 });

  const departamentoSelect = this.page.getByRole("combobox", {
    name: /departamento/i,
  });

  await departamentoSelect.waitFor({
    state: "visible",
    timeout: 60000,
  });

  await this.screenshot("05-delivery-section-loaded");

  await departamentoSelect.click();
    await this.page
      .getByRole("option", { name: address.department, exact: true })
      .click();

    await this.page.getByRole("combobox", { name: /provincia/i }).click();
    await this.page
      .getByRole("option", { name: address.province, exact: true })
      .click();

    await this.page.getByRole("combobox", { name: /distrito/i }).click();
    await this.page
      .getByRole("option", { name: address.district, exact: true })
      .click();

    await this.page.getByRole("textbox", { name: "line1" }).fill(address.street);
    await this.page.getByRole("textbox", { name: "line2" }).fill(address.number);

    await this.screenshot("06-delivery-address");
  }

  async selectShippingMethod() {
  const shippingOption = this.page
    .getByRole("listitem")
    .filter({ hasText: /Para envíos a provincias/i })
    .first();

  await shippingOption.scrollIntoViewIfNeeded();

  await shippingOption.click({
    force: true,
    position: { x: 50, y: 20 }
  });

  await this.page.waitForTimeout(1000);

  await this.screenshot("07-shipping-method");
}

  async acceptTerms() {
    await this.page.getByText(/autorizo el tratamiento/i).click();
    await this.page.getByText(/declaro que he leído/i).click();

    await this.screenshot("08-terms-accepted");
  }

  async continueToPayment() {
    await this.paymentContinueButton.scrollIntoViewIfNeeded();
    await this.paymentContinueButton.click();

    await this.page
      .getByRole("button", { name: /Tarjeta de Crédito \/ Débito/i })
      .waitFor({ state: "visible", timeout: 90000 });

    await this.screenshot("09-payment-step");
  }
}