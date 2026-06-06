import BasePage from './BasePage';

export default class ProductPage extends BasePage {
  constructor(page) {
    super(page);

    this.addToCartUrl = '/pe/ng/p4v1/addToCart?products[0].productCode=RB45DG6300B1PE&products[0].quantity=1';
  }

  async validateProductLoaded() {
    await this.page.goto('/getcookie.html');
    await this.waitForPageLoad();
    await this.screenshot('01-cookie-page');
  }

  async addToCart() {
    await this.page.goto(this.addToCartUrl);
    await this.waitForPageLoad();

    await this.page.goto('/pe/cart');
    await this.waitForPageLoad();

    await this.screenshot('02-product-added-to-cart');
  }
}