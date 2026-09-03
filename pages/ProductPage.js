import BasePage from './BasePage';

export default class ProductPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.cookieUrl = options.setupUrl === undefined
      ? 'https://stg2.shop.samsung.com/getcookie.html'
      : options.setupUrl;
    this.sku = options.sku || 'RB45DG6300B1PE';
    this.pdpUrl = options.pdpUrl || null;

    this.addToCartUrl =
      'https://stg2.shop.samsung.com/pe/ng/p4v1/addToCart?products[0].productCode=RB45DG6300B1PE&products[0].quantity=1&callback=jQuery111305177703263619047_1595407056965&_=1595407056969';

    this.cartUrl = options.cartUrl || 'https://stg2.shop.samsung.com/pe/cart';
  }

  async addConfiguredPdpToCart({ waitForCartMutation = false } = {}) {
    if (!this.pdpUrl) throw new Error('A configured PDP URL is required.');
    await this.safeGoto(this.pdpUrl);
    const addButton = this.page
      .getByRole('button', { name: /Agregar al carrito|Add to cart|Add to basket/i })
      .filter({ visible: true })
      .first();
    await addButton.waitFor({ state: 'visible', timeout: 60000 });
    const cartMutation = waitForCartMutation
      ? this.page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            /\/users\/current\/carts\/(?:current|[^/]+)\/entries(?:\?|$)/.test(response.url()),
          { timeout: 60000 }
        )
      : null;
    await addButton.click();
    if (cartMutation) {
      const response = await cartMutation;
      if (response.status() < 200 || response.status() >= 300) {
        throw new Error(`Configured PDP add-to-cart returned HTTP ${response.status()}.`);
      }
    }
    await this.safeGoto(this.cartUrl);
    await this.waitForCartSkus([this.sku]);
  }

  async validateProductLoaded() {
    await this.safeGoto(this.cookieUrl);

    await this.page
      .getByText(/you can access pages now/i)
      .waitFor({ timeout: 20000 });

    await this.screenshot('01-cookie-page');
  }

  async addToCartForAdditionalServices() {
   const additionalServicesAddToCartUrl =
     "https://stg2.shop.samsung.com/pe/ng/p4v1/addToCart?products%5B0%5D.productCode=SM-F741BLBKPEO&products%5B0%5D.quantity=1&callback=jQuery111305177703263619047_1595407056965&_=1595407056969";
   // Required ST2 setup:
   // 1) add the Galaxy Z Flip6 SKU
   // 2) add the standard refrigerator SKU
   // 3) only then open Cart
   await this.safeGoto(additionalServicesAddToCartUrl);
   await this.safeGoto(this.addToCartUrl);
   await this.safeGoto(this.cartUrl);
   await this.waitForCartSkus(["RB45DG6300B1PE", "SM-F741BLBKPEO"]);
   await this.screenshot("02-additional-services-cart-setup");
 }
  async addToCart() {
    await this.safeGoto(this.addToCartUrl);
    await this.safeGoto(this.cartUrl);
    await this.waitForCartSkus(['RB45DG6300B1PE']);

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
    const isStateChangingCartRequest = /\/addToCart$/i.test(new URL(url).pathname);
    const maxAttempts = isStateChangingCartRequest ? 1 : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        await this.page.waitForTimeout(3000);
      }
    }
  }

  async waitForCartSkus(skus, { reloadAttempts = 2 } = {}) {
    for (let attempt = 0; attempt <= reloadAttempts; attempt++) {
      const results = await Promise.all(
        skus.map((sku) =>
          this.page
            .getByText(sku, { exact: true })
            .first()
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false)
        )
      );
      if (results.every(Boolean)) return;
      if (attempt < reloadAttempts) {
        await this.safeGoto(this.cartUrl);
      }
    }
    throw new Error(`Cart did not render expected SKU(s): ${skus.join(', ')}.`);
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
