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
    await this.page
      .getByRole("option", { name: customer.documentType, exact: true })
      .click();

    await this.documentNumberInput.fill(customer.documentNumber);

    const documentNumber = await this.documentNumberInput.inputValue();
    if (documentNumber !== customer.documentNumber) {
      throw new Error(
        `Document number was reset after selecting the document type. Expected: ${customer.documentNumber} | Actual: ${documentNumber}`
      );
    }

    if (!(await this.customerContinueButton.isEnabled())) {
      throw new Error("Customer Continue button remained disabled after valid Contact Info.");
    }

    await this.screenshot("04-customer-info");

    await Promise.all([
      this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 30000 }),
      this.customerContinueButton.click(),
    ]);

    await this.page
      .getByRole("heading", { name: /Direcci[oó]n de entrega/i })
      .waitFor({ state: "visible", timeout: 60000 });

    await this.screenshot("05-delivery-step");
  }

  async validateAuthenticatedDeliveryForm() {
    const deliveryHeading = this.page.getByRole("heading", {
      name: /Direcci[oó]n de entrega/i,
    });

    await deliveryHeading.waitFor({ state: "visible", timeout: 60000 });

    const deliveryRegion = this.page.getByRole("region", {
      name: /2\. Direcci[oó]n de entrega/i,
    });
    const deliveryPanel = deliveryRegion.getByRole("tabpanel", {
      name: "Envío",
      exact: true,
    });
    const savedAddressMode = deliveryPanel.getByRole("radio", {
      name: "Dirección guardada",
      exact: true,
    });
    await savedAddressMode.waitFor({ state: "visible", timeout: 30000 });

    if (!(await savedAddressMode.isChecked())) {
      await deliveryPanel
        .locator("span")
        .getByText("Dirección guardada", { exact: true })
        .click();
    }
    if (!(await savedAddressMode.isChecked())) {
      throw new Error("Dirección guardada was not selected in authenticated Delivery.");
    }

    const savedAddress = deliveryPanel.locator(
      'input[type="radio"][name^="mat-radio-group"]'
    );
    await savedAddress.waitFor({ state: "visible", timeout: 30000 });

    const newAddress = deliveryPanel.getByRole("radio", {
      name: "Nueva dirección",
      exact: true,
    });
    await deliveryPanel
      .locator("span")
      .getByText("Nueva dirección", { exact: true })
      .click();
    if (!(await newAddress.isChecked())) {
      throw new Error("Nueva dirección was not selected in authenticated Delivery.");
    }

    for (const name of ["Departamento", "Provincia", "Distrito"]) {
      await deliveryPanel
        .getByRole("combobox", { name })
        .waitFor({ state: "visible", timeout: 30000 });
    }

    const saveAddress = deliveryPanel.getByRole("checkbox", {
      name: /Guardar datos de env[ií]o en Mi cuenta/i,
    });
    await saveAddress.waitFor({ state: "visible", timeout: 30000 });

    if (await saveAddress.isChecked()) {
      await deliveryPanel
        .getByText("Guardar datos de envío en Mi cuenta", { exact: true })
        .click();
    }

    if (await saveAddress.isChecked()) {
      throw new Error("Save address checkbox remained checked in the safe authenticated smoke.");
    }
  }

  async saveNewAuthenticatedAddress(address) {
    await this.page.getByRole("tabpanel", {
      name: "Envío",
      exact: true,
    }).waitFor({ state: "visible", timeout: 60000 });
    const newAddress = this.page.getByRole("radio", {
      name: "Nueva dirección",
      exact: true,
    });
    if (await newAddress.isVisible()) {
      await newAddress.check();
    }
    await this.fillAddress(address);
    const deliveryPanel = this.page.getByRole("tabpanel", {
      name: "Envío",
      exact: true,
    });
    const saveAddress = deliveryPanel.getByRole("checkbox", {
      name: /Guardar datos de env[ií]o en Mi cuenta/i,
    });
    if (!(await saveAddress.isChecked())) {
      await deliveryPanel
        .getByText(/Guardar datos de env[ií]o en Mi cuenta/i)
        .click();
    }
    if (!(await saveAddress.isChecked())) {
      throw new Error("Authenticated QA address was not marked for saving.");
    }
  }

  async selectSavedAddressAndValidate() {
    const deliveryRegion = this.page.getByRole("region", {
      name: /2\. Direcci[oó]n de entrega/i,
    });
    const deliveryPanel = deliveryRegion.getByRole("tabpanel", {
      name: "Envío",
      exact: true,
    });
    const savedAddressMode = deliveryPanel.getByRole("radio", {
      name: "Dirección guardada",
      exact: true,
    });

    await savedAddressMode.waitFor({ state: "visible", timeout: 30000 });

    if (!(await savedAddressMode.isChecked())) {
      await deliveryPanel
        .getByText("Dirección guardada", { exact: true })
        .click();
    }

    if (!(await savedAddressMode.isChecked())) {
      throw new Error("Dirección guardada was not selected in authenticated Delivery.");
    }

    const savedAddressOptions = deliveryPanel.getByRole("radio", {
      name: /^(?!Dirección guardada$|Nueva dirección$).+/,
    });
    const optionCount = await savedAddressOptions.count();

    if (optionCount < 1) {
      throw new Error("No saved address was available in authenticated Delivery.");
    }

    let selectedAddress;
    for (const option of await savedAddressOptions.all()) {
      if (await option.isChecked()) {
        selectedAddress = option;
        break;
      }
    }

    if (!selectedAddress) {
      if (optionCount !== 1) {
        throw new Error(
          `Saved address selection is ambiguous: ${optionCount} addresses are available and none is selected.`
        );
      }

      selectedAddress = savedAddressOptions;
      await selectedAddress.click();
    }

    if (!(await selectedAddress.isChecked())) {
      throw new Error("The saved address radio did not remain selected.");
    }

    await this.screenshot("authenticated-saved-address-selected");
  }

  async validateAddressValues(address) {
    const deliveryPanel = this.page.getByRole("tabpanel", {
      name: "Envío",
      exact: true,
    });
    const expectedValues = [
      [deliveryPanel.getByRole("combobox", { name: "Departamento" }), address.department],
      [deliveryPanel.getByRole("combobox", { name: "Provincia" }), address.province],
      [deliveryPanel.getByRole("combobox", { name: "Distrito" }), address.district],
      [deliveryPanel.getByRole("textbox", { name: "line1" }), address.street],
      [deliveryPanel.getByRole("textbox", { name: "line2" }), address.number],
    ];

    for (const [locator, expected] of expectedValues) {
      const actual =
        (await locator.getAttribute("role")) === "combobox"
          ? (await locator.textContent())?.trim()
          : await locator.inputValue();

      if (actual !== expected) {
        throw new Error(`Unexpected Delivery value. Expected: ${expected} | Actual: ${actual}`);
      }
    }
  }

  async validatePhoneNumberInput(phone) {
    await this.page.waitForURL(/CHECKOUT_STEP_CONTACT_INFO/, {
      timeout: 30000,
    });

    await this.phoneInput.fill("");
    await this.phoneInput.fill(phone);

    const value = await this.phoneInput.inputValue();

    if (value !== phone) {
      throw new Error(
        `Phone number was not populated correctly. Expected: ${phone} | Actual: ${value}`
      );
    }

    await this.screenshot("checkout-phone-number");
  }

  async validateCheckoutAddressPage() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const addressTitle = this.page.getByRole("heading", {
      name: /Completa tu dirección de entrega/i,
    });

    const departamentoSelect = this.page.getByRole("combobox", {
      name: /departamento/i,
    });

    await addressTitle.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await departamentoSelect.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("checkout-address-page");
  }

  async validateCheckoutLoginButton() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const loginMessage = this.page
      .getByText(/Iniciar sesi.*n para ganar puntos Samsung Rewards/i)
      .first();

    await loginMessage.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await loginMessage.scrollIntoViewIfNeeded();

    await this.screenshot("checkout-login-option");
  }

  async validateCheckoutProductSummary({ sku } = {}) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const cartQuantity = this.page
      .getByText(/Tienes 1 producto en tu carrito/i)
      .first();

    const productEvidence = sku
      ? this.page.getByText(sku, { exact: true }).first()
      : this.page.getByRole("heading", {
        name: /Refrigeradora Bottom Freezer 409L Black/i,
      }).first();
    const productColor = sku
      ? null
      : this.page.getByText("Black Doi", { exact: true }).first();

    await cartQuantity.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await productEvidence.waitFor({
      state: "visible",
      timeout: 30000,
    });

    if (productColor) {
      await productColor.waitFor({ state: "visible", timeout: 30000 });
    }

    await this.screenshot("checkout-product-summary");
  }

  async validateAddressInput(address) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const addressInput = this.page.getByRole("textbox", {
      name: "line1",
    });

    await addressInput.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await addressInput.fill("");
    await addressInput.fill(address);

    const value = await addressInput.inputValue();

    if (value !== address) {
      throw new Error(
        `Address was not populated correctly. Expected: ${address} | Actual: ${value}`
      );
    }

    await this.screenshot("checkout-address-input");
  }

  async validateAddressLine2Input(value) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const addressLine2Input = this.page.getByRole("textbox", {
      name: "apartment",
    });

    await addressLine2Input.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await addressLine2Input.fill("");
    await addressLine2Input.fill(value);

    const actualValue = await addressLine2Input.inputValue();

    if (actualValue !== value) {
      throw new Error(
        `Address line 2 was not populated correctly. Expected: ${value} | Actual: ${actualValue}`
      );
    }

    await this.screenshot("checkout-address-line2-input");
  }

  async validateCityInput(address) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const departamento = this.page.getByRole("combobox", {
      name: "Departamento",
    });

    const provincia = this.page.getByRole("combobox", {
      name: "Provincia",
    });

    const distrito = this.page.getByRole("combobox", {
      name: "Distrito",
    });

    await departamento.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await departamento.click();
    await this.page
      .getByRole("option", {
        name: address.department,
        exact: true,
      })
      .click();

    await provincia.click();
    await this.page
      .getByRole("option", {
        name: address.province,
        exact: true,
      })
      .click();

    await distrito.click();
    await this.page
      .getByRole("option", {
        name: address.district,
        exact: true,
      })
      .click();

    const selectedDistrict = distrito.locator(
      ".mat-mdc-select-min-line"
    );

    await selectedDistrict.waitFor({
      state: "visible",
      timeout: 30000,
    });

    const selectedDistrictText = (
      await selectedDistrict.textContent()
    )?.trim();

    if (selectedDistrictText !== address.district) {
      throw new Error(
        `District was not selected correctly. Expected: ${address.district} | Actual: ${selectedDistrictText}`
      );
    }

    await this.screenshot("checkout-city-input");
  }

  async validateProvinceInput(address) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const departamento = this.page.getByRole("combobox", {
      name: "Departamento",
    });

    const provincia = this.page.getByRole("combobox", {
      name: "Provincia",
    });

    await departamento.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await departamento.click();
    await this.page
      .getByRole("option", {
        name: address.department,
        exact: true,
      })
      .click();

    await provincia.click();
    await this.page
      .getByRole("option", {
        name: address.province,
        exact: true,
      })
      .click();

    const selectedProvince = provincia.locator(
      ".mat-mdc-select-min-line"
    );

    await selectedProvince.waitFor({
      state: "visible",
      timeout: 30000,
    });

    const selectedProvinceText = (
      await selectedProvince.textContent()
    )?.trim();

    if (selectedProvinceText !== address.province) {
      throw new Error(
        `Province was not selected correctly. Expected: ${address.province} | Actual: ${selectedProvinceText}`
      );
    }

    await this.screenshot("checkout-province-input");
  }

  async validatePostalCodeInput(address) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const postalCode = this.page.getByRole("textbox", {
      name: /postal|código postal/i,
    });

    await postalCode.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await postalCode.fill("");
    await postalCode.fill(address.postalCode);

    const actualValue = await postalCode.inputValue();

    if (actualValue !== String(address.postalCode)) {
      throw new Error(
        `Postal Code was not populated correctly. Expected: ${address.postalCode} | Actual: ${actualValue}`
      );
    }

    await this.screenshot("checkout-postal-code-input");
  }

  async validateGuestCannotSaveAddress() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const deliveryRegion = this.page.getByRole("region", {
      name: /2\. Dirección de entrega/i,
    });

    await deliveryRegion.waitFor({
      state: "visible",
      timeout: 60000,
    });

    const saveAddressCheckbox = deliveryRegion.getByRole("checkbox", {
      name: /guardar.*direcci|save.*address/i,
    });

    const saveAddressButton = deliveryRegion.getByRole("button", {
      name: /guardar.*direcci|save.*address/i,
    });

    const saveAddressText = deliveryRegion.getByText(
      /guardar.*direcci|save.*address/i
    );

    const checkboxCount = await saveAddressCheckbox.count();
    const buttonCount = await saveAddressButton.count();
    const textCount = await saveAddressText.count();

    if (checkboxCount > 0 || buttonCount > 0 || textCount > 0) {
      throw new Error(
        "Guest checkout exposes an option to save the address."
      );
    }

    await this.screenshot("checkout-guest-no-save-address");
  }

  async validateDifferentBillingAddress(billingAddress) {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const billingSection = this.page.locator("app-billing-address-v2");

    await billingSection
      .getByRole("heading", {
        name: "Completa tus datos de facturación",
        level: 3,
      })
      .waitFor({ state: "visible", timeout: 60000 });

    const invoiceCheckbox = billingSection.getByRole("checkbox", {
      name: "Deseo factura",
      exact: true,
    });

    await invoiceCheckbox.check();

    await billingSection
      .getByRole("textbox", { name: "companyName" })
      .fill(billingAddress.companyName);

    await billingSection
      .getByRole("textbox", { name: "companyTaxNumber" })
      .fill(billingAddress.companyTaxNumber);

    const department = billingSection.getByRole("combobox", {
      name: "Departamento",
    });
    const province = billingSection.getByRole("combobox", {
      name: "Provincia",
    });
    const district = billingSection.getByRole("combobox", {
      name: "Distrito",
    });

    await this.selectMaterialOption(department, billingAddress.department);
    await this.selectMaterialOption(province, billingAddress.province);
    await this.selectMaterialOption(district, billingAddress.district);

    const billingStreet = billingSection.getByRole("textbox", {
      name: "line1",
    });
    const billingNumber = billingSection.getByRole("textbox", {
      name: "line2",
    });

    await billingStreet.fill(billingAddress.street);
    await billingNumber.fill(billingAddress.number);

    const selectedDepartment = (await department.textContent())?.trim();
    const selectedProvince = (await province.textContent())?.trim();
    const selectedDistrict = (await district.textContent())?.trim();

    if (selectedDepartment !== billingAddress.department) {
      throw new Error(
        `Unexpected billing department: ${selectedDepartment}`
      );
    }

    if (selectedProvince !== billingAddress.province) {
      throw new Error(`Unexpected billing province: ${selectedProvince}`);
    }

    if (selectedDistrict !== billingAddress.district) {
      throw new Error(`Unexpected billing district: ${selectedDistrict}`);
    }

    if ((await billingStreet.inputValue()) !== billingAddress.street) {
      throw new Error("Billing street was not populated correctly.");
    }

    if ((await billingNumber.inputValue()) !== billingAddress.number) {
      throw new Error("Billing number was not populated correctly.");
    }

    await this.screenshot("checkout-different-billing-address");
  }

  async validateAvailableDeliveryModes() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const deliveryTitle = this.page.getByRole("heading", {
      name: /Escoge tu método de envío/i,
    });

    await deliveryTitle.waitFor({
      state: "visible",
      timeout: 60000,
    });

    const regularLima = this.page
      .getByRole("listitem")
      .filter({ hasText: /Para envíos a Lima/i });

    const regularProvince = this.page
      .getByRole("listitem")
      .filter({ hasText: /Para envíos a provincias/i });

    const scheduledDelivery = this.page
      .getByRole("listitem")
      .filter({ hasText: /Agenda tu envío/i });

    await regularLima.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await regularProvince.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await scheduledDelivery.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("checkout-available-delivery-modes");
  }

  async validateDeliveryModeSelection() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const shippingOption = this.page
      .getByRole("listitem")
      .filter({ hasText: /Para envíos a provincias/i })
      .first();
    await shippingOption.waitFor({ state: "visible", timeout: 30000 });
    await shippingOption.click();

    const orderSummary = this.page
      .getByRole("heading", { name: "Resumen de la orden", exact: true })
      .locator("..");
    await orderSummary
      .getByText("Envío regular", { exact: true })
      .waitFor({ state: "visible", timeout: 30000 });

    await this.screenshot("checkout-selected-delivery-mode");
  }

  async selectMaterialOption(combobox, label) {
    await combobox.click();
    const option = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: label, exact: true });
    await option.waitFor({ state: "visible", timeout: 30000 });
    await option.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest" })
    );
    await option.dispatchEvent("click");
    await combobox
      .filter({ hasText: label })
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async validateCheckoutFooter() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const paymentMethodsHeading = this.page.getByRole("heading", {
      name: /Formas de pago:/i,
    });

    const supportText = this.page.getByText(
      /Para cualquier consulta sobre su compra/i
    );

    const returnsLink = this.page.getByRole("link", {
      name: /política de devolución o cancelación/i,
    });

    const deliveryLink = this.page.getByRole("link", {
      name: /fecha estimada de entrega/i,
    });

    await paymentMethodsHeading.scrollIntoViewIfNeeded();

    await paymentMethodsHeading.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await supportText.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await returnsLink.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await deliveryLink.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("checkout-footer");
  }

  async validateCheckoutPriceBreakdown() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const orderSummary = this.page.getByRole("heading", {
      name: /Resumen de la orden/i,
    });

    const subtotalLabel = this.page
      .getByText("Subtotal", { exact: true })
      .first();

    const totalHeading = this.page.getByRole("heading", {
      name: /^Total$/i,
    }).first();

    await orderSummary.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await subtotalLabel.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await totalHeading.waitFor({
      state: "visible",
      timeout: 30000,
    });

    const subtotalText = await subtotalLabel.locator("..").textContent();
    const totalText = await totalHeading.locator("..").textContent();

    if (!subtotalText || !/S\/\s*[\d,.]+/.test(subtotalText)) {
      throw new Error(`Subtotal inválido no Checkout: ${subtotalText}`);
    }

    if (!totalText || !/S\/\s*[\d,.]+/.test(totalText)) {
      throw new Error(`Total inválido no Checkout: ${totalText}`);
    }

    await this.screenshot("checkout-price-breakdown");
  }

  async fillAddress(address) {
  await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 30000 });

  const deliveryPanel = this.page.getByRole("tabpanel", {
    name: "Envío",
    exact: true,
  });

  const departamentoSelect = deliveryPanel.getByRole("combobox", {
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

    await deliveryPanel.getByRole("combobox", { name: /provincia/i }).click();
    await this.page
      .getByRole("option", { name: address.province, exact: true })
      .click();

    await deliveryPanel.getByRole("combobox", { name: /distrito/i }).click();
    await this.page
      .getByRole("option", { name: address.district, exact: true })
      .click();

    await deliveryPanel.getByRole("textbox", { name: "line1" }).fill(address.street);
    await deliveryPanel.getByRole("textbox", { name: "line2" }).fill(address.number);

    await this.screenshot("06-delivery-address");
  }

  async selectShippingMethod() {
    const deliveryOptions = this.page.locator(
      'input[type="radio"][name$="delivery_mode_option"]'
    );
    await deliveryOptions.first().waitFor({ state: "attached", timeout: 60000 });

    const groupNames = await deliveryOptions.evaluateAll((inputs) => [
      ...new Set(inputs.map((input) => input.name)),
    ]);
    for (const groupName of groupNames) {
      const selected = this.page.locator(
        `input[type="radio"][name="${groupName}"]:checked`
      );
      if (await selected.count()) continue;

      const option = this.page
        .locator(`input[type="radio"][name="${groupName}"]`)
        .first();
      const label = option.locator("xpath=ancestor::label[1]");
      await label.scrollIntoViewIfNeeded();
      await label.click();
      if (!(await option.isChecked())) {
        throw new Error(`Delivery option did not remain selected for ${groupName}.`);
      }
    }

    const checkedGroups = await deliveryOptions.evaluateAll((inputs) => [
      ...new Set(inputs.filter((input) => input.checked).map((input) => input.name)),
    ]);
    if (checkedGroups.length !== groupNames.length) {
      throw new Error(
        `Expected one selected option for ${groupNames.length} delivery groups, found ${checkedGroups.length}.`
      );
    }

    await this.page.waitForTimeout(1000);
    await this.screenshot("07-shipping-method");
  }

  async acceptTerms() {
    await this.page.getByText(/autorizo el tratamiento/i).click();
    await this.page.getByText(/declaro que he leído/i).click();

    await this.screenshot("08-terms-accepted");
  }

  async continueToPayment({
    expectedPaymentMode = /Tarjeta de Crédito \/ Débito/i,
  } = {}) {
    const paymentModeButton = this.page.getByRole("button", {
      name: expectedPaymentMode,
    });

    const deliveryAlert = this.page.getByRole("alert").filter({
      hasText: /Por favor, selecciona una opción de entrega/i,
    });

    for (let attempt = 1; attempt <= 8; attempt++) {
      // Payment já abriu.
      if (await paymentModeButton.isVisible().catch(() => false)) {
        break;
      }

      // Se o ST2 reclamar da entrega, reseleciona o shipping.
      if (await deliveryAlert.isVisible().catch(() => false)) {
        await this.selectShippingMethod();
      }

      // A página pode ter mudado para Payment durante a reseleção.
      if (await paymentModeButton.isVisible().catch(() => false)) {
        break;
      }

      const continueButton = this.page.getByRole("button", {
        name: /continuar con los métodos de pago/i,
      });

      // Espera curta porque durante esse período Payment pode carregar.
      try {
        await continueButton.waitFor({
          state: "visible",
          timeout: 5000,
        });
      } catch {
        if (await paymentModeButton.isVisible().catch(() => false)) {
          break;
        }

        continue;
      }

      await continueButton.scrollIntoViewIfNeeded();
      await continueButton.click();

      try {
        await paymentModeButton.waitFor({
          state: "visible",
          timeout: 5000,
        });

        break;
      } catch {
        // Continua o loop.
        // Se aparecer alerta, reseleciona shipping.
        // Se não, tenta o botão Continuar novamente.
      }
    }

    if (!(await paymentModeButton.isVisible().catch(() => false))) {
      const diagnostics = await this.page.evaluate(() => ({
        url: window.location.href,
        visibleAlerts: [...document.querySelectorAll('[role="alert"]')]
          .filter((element) => element.offsetParent !== null)
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
          .filter(Boolean),
        selectedDeliveryModes: [
          ...document.querySelectorAll(".delivery-mode-tab.button-style.selected-mode"),
        ].map((element) => element.textContent?.replace(/\s+/g, " ").trim()),
        checkedRadios: [...document.querySelectorAll('input[type="radio"]:checked')]
          .map((element) => ({ name: element.name, value: element.value })),
        checkedTerms: [...document.querySelectorAll('input[type="checkbox"]:checked')].length,
      }));
      throw new Error(
        `Delivery did not transition to the expected payment mode: ${JSON.stringify(diagnostics)}`
      );
    }

    await this.screenshot("09-payment-step");
  }


 async navigateBackToCartFromCheckout() {
   const editCartLink = this.page.locator('a[href="/pe/cart"]').first();
   await editCartLink.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await editCartLink.click();
   await this.page.waitForURL(/\/pe\/cart/, {
     timeout: 30000,
   });
   const cartMessage = this.page.getByText(
     /Tienes 1 producto en tu carrito/i
   );
   await cartMessage.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await this.screenshot("checkout-edit-back-to-cart");
 }

}
