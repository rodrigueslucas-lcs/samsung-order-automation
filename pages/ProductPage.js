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
    await this.safeGoto(this.cookieUrl);

    await this.page
      .getByText(/you can access pages now/i)
      .waitFor({ timeout: 20000 });

    await this.screenshot('01-cookie-page');
  }

  async addToCart() {
    await this.safeGoto(this.addToCartUrl);

    await this.page.waitForTimeout(3000);

    await this.safeGoto(this.cartUrl);

    await this.page.waitForTimeout(5000);

    await this.screenshot('02-product-added-to-cart');
  }

  async openPdpFromCart() {
    await this.safeGoto(this.cookieUrl);

    await this.page
      .getByText(/you can access pages now/i)
      .waitFor({ timeout: 20000 });

    await this.safeGoto(this.addToCartUrl);
    await this.page.waitForTimeout(3000);

    await this.safeGoto(this.cartUrl);
    await this.page.waitForTimeout(3000);

    const productLink = this.page.getByRole("link", {
      name: /Refrigeradora Bottom Freezer 409L Black C\/Disp\./i,
    }).first();

    const [pdpPage] = await Promise.all([
      this.page.context().waitForEvent("page"),
      productLink.click(),
    ]);

    await pdpPage.waitForLoadState("domcontentloaded");
    await pdpPage.waitForURL(/\/pe\/p\/RB45DG6300B1PE/);

    return pdpPage;
  }

  async validatePdp(pdpPage) {
    await pdpPage
      .locator("h1.product-label:visible")
      .first()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await pdpPage
      .locator('button[aria-label="Agregar al carrito"]:visible')
      .first()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await pdpPage.screenshot({
      path: "evidence/screenshots/st2-pdp-loaded.png",
      fullPage: true,
    });
  }

  async validateProductAttributes(pdpPage) {
    await pdpPage.bringToFront();

    await pdpPage
      .getByText("RB45DG6300B1PE", { exact: true })
      .first()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await pdpPage
      .getByText(/Black doi/i)
      .first()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await pdpPage.screenshot({
      path: "evidence/screenshots/st2-pdp-attributes.png",
      fullPage: true,
    });
  }

  async safeGoto(url) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        return;
      } catch (error) {
        if (attempt === 3) {
          throw error;
        }

        await this.page.waitForTimeout(3000);
      }
    }
  }
}