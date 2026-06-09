import BasePage from './BasePage';

export default class CartPage extends BasePage {
  constructor(page) {
    super(page);

    this.cartUrl = 'https://stg2.shop.samsung.com/pe/cart';
    this.guestLoginUrl = 'https://stg2.shop.samsung.com/pe/guestlogin/checkout';

    this.continueButton = page.getByRole('button', { name: /^continuar$/i });
    this.cartProductSku = page.getByText('RB45DG6300B1PE', { exact: true });
    this.cartProductName = page.getByRole('heading', {
      name: /Refrigeradora Bottom Freezer/i
    });
  }

  async openCart() {
    await this.page.goto(this.cartUrl, { waitUntil: 'domcontentloaded' });
    await this.screenshot('02-cart-page');
  }

  async validateProductInCart() {
    await this.cartProductSku.waitFor({ state: 'visible', timeout: 30000 });
    await this.cartProductName.waitFor({ state: 'visible', timeout: 30000 });

    await this.screenshot('02-cart-validation');
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
}