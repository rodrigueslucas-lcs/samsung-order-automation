import BasePage from './BasePage';

export default class CartPage extends BasePage {
  constructor(page) {
    super(page);

    this.cartUrl = '/pe/cart';
    this.continueButton = page.getByRole('button', { name: /continuar/i });
    this.cartProductText = page.getByText(/RB45DG6300B1PE/i);
  }

  async openCart() {
    await this.page.goto(this.cartUrl);
    await this.waitForPageLoad();
    await this.screenshot('02-cart-page');
  }

  async validateProductInCart() {
  await this.screenshot('02-cart-validation');

  const productVisible = await this.cartProductText
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (!productVisible) {
    throw new Error(
      'Product SKU RB45DG6300B1PE was not visible in cart. Environment may be under deployment/maintenance.'
    );
  }
}

  async proceedToCheckout() {
    await this.continueButton.click();
    await this.waitForPageLoad();
    await this.screenshot('03-proceed-to-checkout');
  }
}