import BasePage from './BasePage';

export default class CartPage extends BasePage {
  constructor(page) {
    super(page);

    this.cartUrl = 'https://stg2.shop.samsung.com/pe/cart';
    this.guestLoginUrl = 'https://stg2.shop.samsung.com/pe/guestlogin/checkout';

    this.continueButton = page.getByRole('button', { name: /^continuar$/i });

    this.cartPageTitle = page.getByText(/Tienes 1 producto en tu carrito/i);
    this.cartProductSku = page.getByText('RB45DG6300B1PE', { exact: true });
    this.cartProductName = page.getByRole('heading', {
      name: /Refrigeradora Bottom Freezer/i
    });

    this.orderSummaryTitle = page.getByRole('heading', {
      name: /Resumen de la orden/i
    });

    this.subtotalLabel = page.getByText('Subtotal', { exact: true });

    this.totalTitle = page.getByRole('heading', {
      name: /^Total$/i
    });
  }

  async openCart() {
    await this.page.goto(this.cartUrl, { waitUntil: 'domcontentloaded' });
    await this.screenshot('02-cart-page');
  }

  async validateCartPage() {
    await this.page.waitForURL(/\/pe\/cart/, {
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
    await this.cartProductName.waitFor({ state: 'visible', timeout: 30000 });

    await this.screenshot('02-cart-validation');
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

    const subtotal = subtotalText?.match(/S\/\s*[\d,.]+/)?.[0];
    const total = totalText?.match(/S\/\s*[\d,.]+/)?.[0];

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

    const reachedGuestLogin = await guestEmailInput
      .waitFor({ state: 'visible', timeout: 45000 })
      .then(() => true)
      .catch(() => false);

    if (reachedGuestLogin) {
      await this.screenshot('03-guest-login-page');
      return;
    }

    await this.screenshot('02-cart-continue-stuck-loading');

    await this.page.goto(this.guestLoginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await guestEmailInput.waitFor({ state: 'visible', timeout: 30000 });

    await this.screenshot('03-guest-login-page-fallback');
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


  async validateExternalServicesVisible() {
   const main = this.page.getByRole("main");
   const addServiceButton = main.getByRole("button", {
     name: "Añadir Insurance",
     exact: true,
   });
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


  async validateSamsungCareButton() {

    const main = this.page.getByRole("main");

    const addServiceButton = main.getByRole("button", {

      name: "Añadir Insurance",

      exact: true,

    });

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
   const main = this.page.getByRole("main");
   const addServiceButton = main.getByRole("button", {
     name: "Añadir Insurance",
     exact: true,
   });
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