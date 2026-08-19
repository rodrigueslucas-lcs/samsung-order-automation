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

  async validateCheckoutProductSummary() {
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, {
      timeout: 30000,
    });

    const cartQuantity = this.page
      .getByText(/Tienes 1 producto en tu carrito/i)
      .first();

    const productName = this.page.getByRole("heading", {
      name: /Refrigeradora Bottom Freezer 409L Black/i,
    }).first();

    const productColor = this.page
      .getByText("Black Doi", { exact: true })
      .first();

    await cartQuantity.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await productName.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await productColor.waitFor({
      state: "visible",
      timeout: 30000,
    });

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

    await shippingOption.scrollIntoViewIfNeeded();

    await shippingOption.click({
      force: true,
      position: { x: 50, y: 20 },
    });

    const selectedMode = this.page
      .locator(".delivery-mode-tab.button-style.selected-mode")
      .filter({ hasText: /Envío regular/i });

    await selectedMode.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("checkout-selected-delivery-mode");
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
    const creditCardButton = this.page.getByRole("button", {
      name: /Tarjeta de Crédito \/ Débito/i,
    });

    const deliveryAlert = this.page.getByRole("alert").filter({
      hasText: /Por favor, selecciona una opción de entrega/i,
    });

    for (let attempt = 1; attempt <= 8; attempt++) {
      // Payment já abriu.
      if (await creditCardButton.isVisible().catch(() => false)) {
        break;
      }

      // Se o ST2 reclamar da entrega, reseleciona o shipping.
      if (await deliveryAlert.isVisible().catch(() => false)) {
        const shippingOption = this.page
          .getByRole("listitem")
          .filter({ hasText: /Para envíos a provincias/i })
          .first();

        await shippingOption.scrollIntoViewIfNeeded();

        await shippingOption.click({
          force: true,
          position: { x: 50, y: 20 },
        });

        await this.page
          .locator(".delivery-mode-tab.button-style.selected-mode")
          .filter({ hasText: /Envío regular/i })
          .waitFor({
            state: "visible",
            timeout: 30000,
          });
      }

      // A página pode ter mudado para Payment durante a reseleção.
      if (await creditCardButton.isVisible().catch(() => false)) {
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
        if (await creditCardButton.isVisible().catch(() => false)) {
          break;
        }

        continue;
      }

      await continueButton.scrollIntoViewIfNeeded();
      await continueButton.click();

      try {
        await creditCardButton.waitFor({
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

    await creditCardButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await this.screenshot("09-payment-step");
  }

}