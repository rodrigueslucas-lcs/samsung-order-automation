import BasePage from './BasePage';

export default class CartPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.cartUrl = options.cartUrl || 'https://stg2.shop.samsung.com/pe/cart';
    this.sku = options.sku || 'RB45DG6300B1PE';

    this.continueButton = page.getByRole('button', {
      name: options.checkoutButtonPattern || /^continuar$/i
    });

    this.cartPageTitle = page.getByText(/Tienes 1 producto en tu carrito/i);
    this.cartProductSku = page.getByText(this.sku, { exact: true });
    this.cartProductName = options.productNamePattern === null
      ? null
      : page.getByRole('heading', {
        name: options.productNamePattern || /Refrigeradora Bottom Freezer/i
      });

    this.orderSummaryTitle = page.getByRole('heading', {
      name: options.orderSummaryPattern || /Resumen de la orden/i
    });

    this.subtotalLabel = page.getByText('Subtotal', { exact: true });

    this.totalTitle = page.getByRole('heading', {
      name: options.totalPattern || /^Total$/i
    });
    this.currencyPattern = options.currencyPattern || /S\/\s*[\d,.]+/;
  }

  async openCart() {
    await this.page.goto(this.cartUrl, { waitUntil: 'domcontentloaded' });
    await this.screenshot('02-cart-page');
  }

  async validateCartPage() {
    const expectedPath = new URL(this.cartUrl).pathname;
    await this.page.waitForURL((url) => url.pathname === expectedPath, {
      timeout: 30000
    });

    await this.cartPageTitle.waitFor({
      state: 'visible',
      timeout: 30000
    });

    await this.screenshot('cart-page-visible');
  }

  async validateProductInCart() {
    await this.cartProductSku.waitFor({ state: 'visible', timeout: 30000 });
    if (this.cartProductName) {
      await this.cartProductName.waitFor({ state: 'visible', timeout: 30000 });
    }

    await this.screenshot('02-cart-validation');
  }

  async validateQuantityCanChange() {
    const quantity = this.page.getByRole('textbox', { name: 'Quantity' });
    const plusButton = this.page.getByRole('button', { name: '+', exact: true });
    const minusButton = this.page.getByRole('button', { name: '-', exact: true });
    await quantity.waitFor({ state: 'visible', timeout: 30000 });
    const initial = await quantity.inputValue();
    await plusButton.click();
    await this.waitForQuantityValue(quantity, String(Number(initial) + 1));
    await minusButton.click();
    await this.waitForQuantityValue(quantity, initial);
  }

  async waitForQuantityValue(quantity, expected, timeout = 30000) {
    const deadline = Date.now() + timeout;
    let actual = await quantity.inputValue();
    while (actual !== expected && Date.now() < deadline) {
      await this.page.waitForTimeout(200);
      actual = await quantity.inputValue();
    }
    if (actual !== expected) {
      throw new Error(`Cart quantity was ${actual}; expected ${expected}.`);
    }
  }

  async validateOrderSummary() {
    await this.orderSummaryTitle.waitFor({
      state: 'visible',
      timeout: 30000
    });

    await this.subtotalLabel.waitFor({
      state: 'visible',
      timeout: 30000
    });

    await this.totalTitle.waitFor({
      state: 'visible',
      timeout: 30000
    });

    const subtotalContainer = this.subtotalLabel.locator('..');
    const totalContainer = this.totalTitle.locator('..');

    const subtotalText = await subtotalContainer.textContent();
    const totalText = await totalContainer.textContent();

    const subtotal = subtotalText?.match(this.currencyPattern)?.[0];
    const total = totalText?.match(this.currencyPattern)?.[0];

    await this.screenshot('cart-order-summary');

    return {
      subtotal,
      total
    };
  }

  async validateCheckoutButton() {
    await this.continueButton.waitFor({
      state: 'visible',
      timeout: 30000
    });

    await this.continueButton.scrollIntoViewIfNeeded();

    await this.screenshot('cart-checkout-button');
  }

  async proceedToCheckout() {
    await this.continueButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.continueButton.scrollIntoViewIfNeeded();

    await this.screenshot('02-before-cart-continue');

    await this.continueButton.click();

    const guestEmailInput = this.page.getByPlaceholder(/ingresa tu correo/i);

    await guestEmailInput.waitFor({ state: 'visible', timeout: 45000 });

    await this.screenshot('03-guest-login-page');
  }

  async proceedToAuthenticatedCheckout() {
    await this.continueButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.continueButton.scrollIntoViewIfNeeded();

    await Promise.all([
      this.page.waitForURL(/CHECKOUT_STEP_CONTACT_INFO/, { timeout: 60000 }),
      this.continueButton.click()
    ]);
  }


  async validateCartFooter() {

    const footer = this.page.getByRole("contentinfo");

    await footer.scrollIntoViewIfNeeded();

    await footer.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const tienda = footer.getByRole("heading", {

      name: "Tienda",

      level: 2,

    });

    const productos = footer.getByRole("heading", {

      name: "Productos",

      level: 2,

    });

    const soporte = footer.getByRole("heading", {

      name: "Soporte",

      level: 2,

    });

    const cuenta = footer.getByRole("heading", {

      name: "Cuenta",

      level: 2,

    });

    const privacidad = footer.getByText("Privacidad", {
     exact: true,
   });

    await tienda.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await productos.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await soporte.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await cuenta.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await privacidad.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await this.screenshot("cart-footer");

  }

  getAdditionalServicesButton() {
    return this.page
      .getByRole("main")
      .getByRole("button", {
        name: "Añadir Servicios Adicionales",
        exact: true,
      });
  }


  async validateExternalServicesVisible() {
   const main = this.page.getByRole("main");
   const addServiceButton = this.getAdditionalServicesButton();
   const samsungCare = main.getByText("Samsung Care+", {
     exact: true,
   });
   await addServiceButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await samsungCare.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await this.screenshot("cart-external-service-visible");
 }

  async inspectAddedServicesAndRecommendedProducts() {
    const main = this.page.getByRole("main");
    const additionalServicesButton = main
      .locator('button[data-an-la="add service:samsung care"]')
      .filter({ hasText: "Servicios Adicionales" });

    await additionalServicesButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    const recommendationSection = main.getByText(
      /Productos recomendados|Recomendados para ti|También te puede gustar/i
    );
    const recommendationVisible = await recommendationSection
      .first()
      .isVisible()
      .catch(() => false);

    await this.screenshot(
      recommendationVisible
        ? "cart-added-services-and-recommendations"
        : "cart-added-services-without-recommendations"
    );

    return { additionalServicesVisible: true, recommendationVisible };
  }


  async validateSamsungCareButton() {
    const addServiceButton = this.getAdditionalServicesButton();

    await addServiceButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await addServiceButton.click();

    const servicesHeading = this.page.getByRole("heading", {

      name: "Servicios Adicionales",

      level: 1,

    });

    await servicesHeading.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const cancelButton = this.page.getByRole("button", {

      name: "Cancelar",

      exact: true,

    });

    await cancelButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await this.screenshot("cart-samsung-care-modal");

    await cancelButton.click();

    await servicesHeading.waitFor({

      state: "hidden",

      timeout: 30000,

    });

  }



 async validateSamsungCareJourney() {
   const addServiceButton = this.getAdditionalServicesButton();
   await addServiceButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await addServiceButton.click();
   const servicesHeading = this.page.getByRole("heading", {
     name: "Servicios Adicionales",
     level: 1,
   });
   await servicesHeading.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const serviceOptions = this.page.getByRole("radio", {
     name: /Select AI - Programa de Subscripción y Mantenimiento/i,
   });
   const optionCount = await serviceOptions.count();
   if (optionCount < 1) {
     throw new Error("No Select AI service options were found.");
   }
   const termsHeading = this.page.getByRole("heading", {
     name: "Términos y condiciones de los Servicios Adicionales",
     level: 4,
   });
   await termsHeading.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const termsCheckbox = this.page.getByRole("checkbox", {
     name: /He leído y acepto los términos y condiciones de Select AI/i,
   });
   await termsCheckbox.waitFor({
     state: "visible",
     timeout: 30000,
   });
   if (await termsCheckbox.isChecked()) {
     throw new Error("Terms checkbox should not be selected by default.");
   }
   const addToCartButton = this.page.getByRole("button", {
     name: "Agregar al carrito",
     exact: true,
   });
   await addToCartButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   if (await addToCartButton.isEnabled()) {
     throw new Error(
       "Agregar al carrito should be disabled before terms are accepted."
     );
   }
   await this.screenshot("cart-samsung-care-journey");
   const cancelButton = this.page.getByRole("button", {
     name: "Cancelar",
     exact: true,
   });
   await cancelButton.click();
   await servicesHeading.waitFor({
     state: "hidden",
     timeout: 30000,
   });
 }



  async openTradeInJourney() {

    const main = this.page.getByRole("main");

    const tradeInButton = main.getByRole("button", {

      name: "Añadir Plan Canje Galaxy",

      exact: true,

    });

    await tradeInButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await tradeInButton.scrollIntoViewIfNeeded();

    await tradeInButton.click();

    // Trade-in must produce an observable journey UI.

    const journey = this.page

      .getByRole("dialog")

      .filter({ visible: true });

    await journey.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await this.screenshot("cart-trade-in-journey-open");

    return journey;

  }

  async clickTradeInContinue(dialog) {
    const continueButton = dialog.getByRole("button", {
      name: "Continuar",
      exact: true,
    });

    await continueButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    const timeoutAt = Date.now() + 30000;

    while (!(await continueButton.isEnabled())) {
      if (Date.now() > timeoutAt) {
        throw new Error("Trade-in Continuar button did not become enabled.");
      }

      await this.page.waitForTimeout(250);
    }

    await continueButton.click();
  }

  async completeTradeInJourney() {
    const dialog = this.page.getByRole("dialog").filter({ visible: true });

    await dialog
      .getByText("Selecciona tu equipo a reciclar", { exact: true })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    // Category
    const smartphone = dialog.getByText("SMARTPHONE", { exact: true });
    await smartphone.waitFor({ state: "visible", timeout: 30000 });
    await smartphone.click();

    // Brand
    const samsungSelection = dialog.getByText("Samsung", {
      exact: true,
    }).first();

    await samsungSelection.waitFor({
      state: "visible",
      timeout: 30000,
    });

    // Open brand selector only if necessary.
    await samsungSelection.click();

    const samsungOption = dialog
      .locator(".trade-in_dropdown-list")
      .getByText("Samsung", { exact: true });

    if (await samsungOption.count()) {
      await samsungOption.first().click();
    }

    // Model - dropdown already expanded; click the real option text element
    const galaxyS25Option = dialog
      .locator("span.option-brand", {
        hasText: "Galaxy S25",
      })
      .first();

    await galaxyS25Option.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await galaxyS25Option.click();

    // Capacity is automatically populated for Galaxy S25.
    await dialog
      .getByText("256GB", { exact: true })
      .first()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    const selectedDeviceCard = dialog
      .getByRole("heading", {
        name: "Galaxy S25 | 256GB",
        exact: true,
      })
      .locator("..");

    await selectedDeviceCard
      .getByText("Valoración estimada", { exact: true })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await selectedDeviceCard
      .getByText("S/ 1,100.00", { exact: true })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await this.clickTradeInContinue(dialog);

    // IMEI
    await dialog
      .getByText(/Casi listo.*número de IMEI/i)
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    const imeiInput = dialog.getByRole("textbox");

    await imeiInput.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await imeiInput.fill("517295184717843");

    await dialog
      .getByText(/IMEI es válido/i)
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await this.clickTradeInContinue(dialog);

    // Device condition
    await dialog
      .getByRole("heading", {
        name: /Último paso.*buenas condiciones/i,
      })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    const yesOptions = dialog.getByRole("radio", {
      name: "Si",
      exact: true,
    });

    await yesOptions.first().waitFor({
      state: "visible",
      timeout: 30000,
    });

    const yesCount = await yesOptions.count();

    if (yesCount !== 3) {
      throw new Error(
        `Expected exactly 3 Trade-in "Si" options, received ${yesCount}.`
      );
    }

    for (let i = 0; i < 3; i++) {
      const radio = yesOptions.nth(i);

      const mdcRadio = radio.locator("..");
      const touchTarget = mdcRadio.locator(".mat-mdc-radio-touch-target");

      await touchTarget.click();

      if (!(await radio.isChecked())) {
        throw new Error(
          `Trade-in condition radio Si ${i + 1} was not selected.`
        );
      }
    }

    await this.clickTradeInContinue(dialog);

    // Final review
    await dialog
      .getByText(
        /Entrega tu smartphone actual y recibe tu bonificación/i
      )
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await dialog
      .getByText(/Galaxy S25\s*\|\s*256GB/i)
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await dialog
      .getByText("S/ 1,100.00", { exact: true })
      .last()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await this.screenshot("cart-trade-in-final-review");

    const termsCheckbox = dialog.getByRole("checkbox");

    await termsCheckbox.waitFor({
      state: "visible",
      timeout: 30000,
    });

    if (!(await termsCheckbox.isChecked())) {
      await termsCheckbox.check();
    }

    const finishButton = dialog.getByRole("button", {
      name: "Finalizar",
      exact: true,
    });

    await finishButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    if (!(await finishButton.isEnabled())) {
      throw new Error(
        "Trade-in Finalizar button did not become enabled."
      );
    }

    await finishButton.click();

    await dialog.waitFor({
      state: "hidden",
      timeout: 30000,
    });

    await this.screenshot("cart-trade-in-added");
  }

  async validateTradeInAdded() {
    const main = this.page.getByRole("main");

    const tradeInBlock = main
      .getByRole("heading", {
        name: /Plan Canje Galaxy/i,
      })
      .first()
      .locator("..");

    await tradeInBlock
      .getByText("Galaxy S25 | 256GB", { exact: true })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await tradeInBlock
      .getByText("-S/ 1,100.00", { exact: true })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await tradeInBlock
      .getByText(/Se aplicó correctamente el Plan Canje Galaxy/i)
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await this.screenshot("cart-trade-in-confirmed");
  }

  async validateTradeInSummaryAmount() {
    const main = this.page.getByRole("main");

    await main
      .getByText(
        /El valor estimado de tu Galaxy S25\s*\|\s*256GB es de hasta S\/\s*1,100\.00/i
      )
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await main
      .getByText("- S/ 1,100.00", {
        exact: true,
      })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await this.screenshot("cart-trade-in-summary");
  }

  async addFunctionalAdditionalService({ acceptTerms = true, submit = true } = {}) {

    const main = this.page.getByRole("main");

    const addServiceButton = main.locator(
     'button[data-an-la="add service:samsung care"]'
   ).filter({ hasText: "Servicios Adicionales" });
    await addServiceButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await addServiceButton.click();

    const dialog = this.page.getByRole("dialog").filter({ visible: true });

    const servicesHeading = dialog.getByRole("heading", {

      name: "Servicios Adicionales",

      level: 1,

    });

    await servicesHeading.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const serviceOption = dialog.getByRole("radio", {

      name: /SC\+.*Mantenimiento preventivo.*French Door.*2 años/i,

    });

    await serviceOption.waitFor({

      state: "visible",

      timeout: 30000,

    });

    if (!(await serviceOption.isChecked())) {

      await serviceOption.check();

    }

    const termsCheckbox = dialog.getByRole("checkbox");

    await termsCheckbox.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const addToCartButton = dialog.getByRole("button", {

      name: "Agregar al carrito",

      exact: true,

    });

    await addToCartButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    if (await addToCartButton.isEnabled()) {

      throw new Error(

        "Agregar al carrito should be disabled before accepting the terms."

      );

    }

    if (!acceptTerms) {
      await this.screenshot("cart-functional-additional-service-modal");
      return;
    }

    await termsCheckbox.check();

    if (!(await addToCartButton.isEnabled())) {

      throw new Error(

        "Agregar al carrito did not become enabled after accepting the terms."

      );

    }

    await this.screenshot("cart-functional-additional-service-ready");

    if (!submit) {
      return;
    }

    await addToCartButton.click();

    await servicesHeading.waitFor({

      state: "hidden",

      timeout: 30000,

    });

    await this.screenshot("cart-functional-additional-service-added");

  }

  async validateAddedAdditionalService() {

    const serviceItem = this.page.getByRole("main");

    await serviceItem

      .getByText(

        /SC\+.*Mantenimiento preventivo.*French Door.*2 años/i

      )

      .first()

      .waitFor({

        state: "visible",

        timeout: 30000,

      });

    await serviceItem

      .getByText("S/ 389.00", {

        exact: true,

      })

      .first()

      .waitFor({

        state: "visible",

        timeout: 30000,

      });

    await this.screenshot("cart-additional-service-added");

  }

  async readCartTotal() {

    await this.totalTitle.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const container = this.totalTitle.locator("..");

    const text = await container.innerText();

    const match = text.match(/S\/\s*([\d,.]+)/);

    if (!match) {

      throw new Error(`Cart Total value was not found. Content: ${text}`);

    }

    return Number(match[1].replace(/,/g, ""));

  }

  async validateQuantityLowerBoundary() {

    const quantityInput = this.page.getByRole("textbox", {

      name: "Quantity",

    });

    const decreaseButton = this.page.getByRole("button", {

      name: "-",

      exact: true,

    });

    const increaseButton = this.page.getByRole("button", {

      name: "+",

      exact: true,

    });

    await quantityInput.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const quantity = await quantityInput.inputValue();

    if (quantity !== "1") {

      throw new Error(

        `Expected cart quantity to be 1, but received ${quantity}.`

      );

    }

    if (await decreaseButton.isEnabled()) {

      throw new Error(

        "Decrease quantity button should be disabled when quantity is 1."

      );

    }

    if (!(await increaseButton.isEnabled())) {

      throw new Error(

        "Increase quantity button should remain enabled when quantity is 1."

      );

    }

    await this.screenshot("cart-quantity-lower-boundary");

  }



 async validateCartPaymentMethods() {
   const main = this.page.getByRole("main");
   const paymentHeading = main.getByRole("heading", {
     name: "Formas de pago:",
     level: 2,
   });
   await paymentHeading.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const expectedPaymentImages = [
     "Visa",
     "Mastercard",
     "America Express",
     "Diners Club",
     "Pago Efectivo",
     "Cuotealo",
     "Samsung-Rewards",
   ];
   for (const name of expectedPaymentImages) {
     const paymentMethod = main.getByRole("img", {
       name,
       exact: true,
     });
     await paymentMethod.waitFor({
       state: "visible",
       timeout: 30000,
     });
   }
   const supportMessage = main.getByText(
     /Para cualquier consulta sobre su compra/i
   );
   await supportMessage.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await this.screenshot("cart-payment-methods-visible");
 }


  async validateInvalidCoupon() {
   const main = this.page.getByRole("main");
   const couponInput = main.getByRole("textbox", {
     name: "Cupones",
   });
   const applyButton = main.getByRole("button", {
     name: "Aplicar",
     exact: true,
   });
   const totalHeading = main.getByRole("heading", {
     name: "Total",
     exact: true,
   });
   await couponInput.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const totalContainer = totalHeading.locator("..");
   const totalBefore = await totalContainer.textContent();
   await couponInput.fill("INVALID-QA-COUPON-999");
   await applyButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await applyButton.click();
   const processingMessage = main.getByText(
     /Espere mientras aplicamos el código de promoción/i
   );
   // O ST2 processa o cupom de forma assíncrona.
   if (await processingMessage.isVisible().catch(() => false)) {
     await processingMessage.waitFor({
       state: "hidden",
       timeout: 60000,
     });
   }
   // Aguarda o estado do Cart estabilizar novamente.
   await applyButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const totalAfter = await totalContainer.textContent();
   if (totalBefore !== totalAfter) {
     throw new Error(
       `Cart total changed after invalid coupon. Before=${totalBefore} After=${totalAfter}`
     );
   }
   const couponValue = await couponInput.inputValue();
   if (couponValue !== "INVALID-QA-COUPON-999") {
     throw new Error(
       `Unexpected coupon state after rejection. Value=${couponValue}`
     );
   }
   await this.screenshot("cart-invalid-coupon-validation");
 }

}
