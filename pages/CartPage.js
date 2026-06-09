import BasePage from './BasePage';

export default class CartPage extends BasePage {
  constructor(page) {
    super(page);

    this.cartUrl = 'https://stg2.shop.samsung.com/pe/cart';
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
    await this.screenshot('02-cart-validation');

    await this.cartProductSku.waitFor({
      state: 'visible',
      timeout: 15000
    });

    await this.cartProductName.waitFor({
      state: 'visible',
      timeout: 15000
    });
  }

  async proceedToCheckout() {
    await this.continueButton.click();
    await this.waitForPageLoad();
    await this.screenshot('03-proceed-to-checkout');
  }
}