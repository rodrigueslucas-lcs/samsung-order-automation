import BasePage from './BasePage';

export default class GuestLoginPage extends BasePage {
  constructor(page) {
    super(page);

    this.emailInput = page.getByPlaceholder(/ingresa tu correo/i);
    this.guestCheckoutButton = page.getByRole('button', { name: /checkout como invitado/i });
  }

  async checkoutAsGuest(email) {
    await this.emailInput.fill(email);
    await this.screenshot('03-guest-email-filled');

    await this.guestCheckoutButton.click();
    await this.waitForPageLoad();

    await this.screenshot('04-checkout-contact-info');
  }
}