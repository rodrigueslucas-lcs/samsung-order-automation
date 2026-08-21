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
    await this.safeGoto(this.cartUrl);

    await this.page
      .getByText('RB45DG6300B1PE', { exact: true })
      .waitFor({ state: 'visible', timeout: 30000 });

    await this.screenshot('02-product-added-to-cart');
  }

  async openPdpFromCart() {
    await this.safeGoto(this.cookieUrl);

    await this.page
      .getByText(/you can access pages now/i)
      .waitFor({ timeout: 20000 });

    await this.safeGoto(this.addToCartUrl);
    await this.safeGoto(this.cartUrl);

    const productLink = this.page.getByRole("link", {
      name: /Refrigeradora Bottom Freezer 409L Black C\/Disp\./i,
    }).first();

    await productLink.waitFor({ state: "visible", timeout: 30000 });

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

  async validateSelectedColorVariant(pdpPage) {
    await pdpPage
      .getByText("Choose your color", { exact: true })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await pdpPage
      .getByText(/Black Doi/i)
      .last()
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await pdpPage.screenshot({
      path: "evidence/screenshots/st2-pdp-selected-variant.png",
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


  async validatePdpDetails() {

    const main = this.page.getByRole("main");

    const productTitle = main.getByRole("heading", {

      name: /Refrigeradora Bottom Freezer 409L Black/i,

    }).last();

    const sku = main.getByText("RB45DG6300B1PE", {

      exact: true,

    });

    const addToCartButton = main.getByRole("button", {

      name: "Agregar al carrito",

      exact: true,

    }).first();

    await productTitle.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await sku.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await addToCartButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    // =========================

    // Product Gallery

    // =========================

    const gallerySlides = main.getByRole("tab", {

      name: /Slide \d+ of \d+/i,

    });

    const slideCount = await gallerySlides.count();

    if (slideCount < 1) {

      throw new Error("PDP gallery slides were not found.");

    }

    const nextButton = main.getByRole("button", {

      name: "Next",

      exact: true,

    });

    await nextButton.waitFor({

      state: "visible",

      timeout: 30000,

    });

    // =========================

    // Specifications

    // =========================

    const specifications = main.getByRole("heading", {

      name: "Specifications",

      exact: true,

    });

    await specifications.scrollIntoViewIfNeeded();

    await specifications.waitFor({

      state: "visible",

      timeout: 30000,

    });

    // =========================

    // Recommendations

    // =========================

    const recommendations = main.getByRole("heading", {

      name: "Frequently bought together",

      exact: true,

    });

    await recommendations.scrollIntoViewIfNeeded();

    await recommendations.waitFor({

      state: "visible",

      timeout: 30000,

    });

    const recommendedMicrowave = main.getByRole("link", {

      name: /MICROONDAS/i,

    }).first();

    await recommendedMicrowave.waitFor({

      state: "visible",

      timeout: 30000,

    });

    await this.screenshot("pdp-details-gallery-specifications-recommendations");

  }


}
