import BasePage from './BasePage';

export default class GuestLoginPage extends BasePage {
  constructor(page) {
    super(page);

    this.emailInput = page.getByPlaceholder(/ingresa tu correo/i);
    this.guestCheckoutButton = page.getByRole('button', {
      name: /checkout como invitado/i
    });
  }

  async validateCheckoutLoginPage() {
    await this.emailInput.waitFor({
      state: 'visible',
      timeout: 30000
    });

    await this.guestCheckoutButton.waitFor({
      state: 'visible',
      timeout: 30000
    });

    await this.screenshot('checkout-login-page');
  }

  async checkoutAsGuest(email) {
    if (!email || typeof email !== 'string') {
      throw new Error(`Guest email inválido. Valor recebido: ${email}`);
    }

    await this.emailInput.fill(email);
    await this.guestCheckoutButton.waitFor({
      state: 'visible',
      timeout: 15000
    });

    await this.screenshot('03-guest-email-filled');

    await this.guestCheckoutButton.click();

    await this.page.waitForURL(/checkout\/one/i, {
      timeout: 60000
    });

    await this.screenshot('04-checkout-contact-info');
  }

 async validateInvalidGuestEmail() {
   const emailInput = this.page.getByPlaceholder(
     "Ingresa tu correo para proceder al pago"
   );
   const guestCheckoutButton = this.page.getByRole("button", {
     name: "Checkout como invitado",
     exact: true,
   });
   await emailInput.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await emailInput.fill("qa-invalid");
   await emailInput.blur();
   const validationMessage = this.page.getByText(
     "Por favor, ingresa un correo válido",
     { exact: true }
   );
   await validationMessage.waitFor({
     state: "visible",
     timeout: 30000,
   });
   if (await guestCheckoutButton.isEnabled()) {
     throw new Error(
       "Guest checkout button should remain disabled for invalid email."
     );
   }
   await this.screenshot("guest-invalid-email-validation");
 }

}