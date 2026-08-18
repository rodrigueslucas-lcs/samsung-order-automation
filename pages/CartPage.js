import BasePage from './BasePage';

export default class CartPage extends BasePage {
  constructor(page) {
    super(page);

    this.cartUrl = 'https://stg2.shop.samsung.com/pe/cart';
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
    await guestEmailInput.waitFor({ state: 'visible', timeout: 60000 });
    await this.page.waitForURL(/\/pe\/guestlogin\/checkout/, { timeout: 60000 });

    await this.screenshot('03-guest-login-page');
  }
}
