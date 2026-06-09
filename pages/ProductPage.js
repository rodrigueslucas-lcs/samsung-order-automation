import BasePage from './BasePage';

export default class ProductPage extends BasePage {
  constructor(page) {
    super(page);

    this.cookieUrl = 'https://stg2.shop.samsung.com/getcookie.html';

    this.addToCartUrl =
      'https://stg2.shop.samsung.com/pe/ng/p4v1/addToCart?products[0].productCode=RB45DG6300B1PE&products[0].quantity=1&callback=jQuery111305177703263619047_1595407056965&_=1595407056969';

    this.cartUrl = 'https://stg2.shop.samsung.com/pe/cart';
  }

  async validateProductLoaded() {
    await this.page.goto(this.cookieUrl, { waitUntil: 'domcontentloaded' });

    await this.page
      .getByText(/you can access pages now/i)
      .waitFor({ timeout: 20000 });

    await this.screenshot('01-cookie-page');
  }

  async addToCart() {
    await this.page.goto(this.addToCartUrl, { waitUntil: 'domcontentloaded' });

    await this.page.waitForTimeout(3000);

    await this.page.goto(this.cartUrl, { waitUntil: 'domcontentloaded' });

    await this.page.waitForTimeout(5000);

    await this.screenshot('02-product-added-to-cart');
  }
}