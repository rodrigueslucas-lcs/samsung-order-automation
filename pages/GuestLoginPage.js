import BasePage from './BasePage';

export default class GuestLoginPage extends BasePage {
  constructor(page) {
    super(page);

    this.emailInput = page.getByPlaceholder(/ingresa tu correo/i);
    this.guestCheckoutButton = page.getByRole('button', {
      name: /checkout como invitado/i
    });
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
}