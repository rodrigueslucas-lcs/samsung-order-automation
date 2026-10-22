import BasePage from './BasePage';

export default class ProductPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.cookieUrl = options.setupUrl === undefined
      ? 'https://stg2.shop.samsung.com/getcookie.html'
      : options.setupUrl;
    this.sku = options.sku || 'RB45DG6300B1PE';
    this.pdpUrl = options.pdpUrl || null;
    this.cartReadback = options.cartReadback;
    this.reuseLoadedPdp = options.reuseLoadedPdp === true;

    this.addToCartUrl =
      'https://stg2.shop.samsung.com/pe/ng/p4v1/addToCart?products[0].productCode=RB45DG6300B1PE&products[0].quantity=1&callback=jQuery111305177703263619047_1595407056965&_=1595407056969';

    this.cartUrl = options.cartUrl || 'https://stg2.shop.samsung.com/pe/cart';
  }

  async addConfiguredPdpToCart({ waitForCartMutation = false, configureProduct, diagnostics,
    recoverBlankPdp, addButtonName = /Agregar al (?:carro|carrito)|Add to cart|Add to basket/i } = {}) {
    if (!this.pdpUrl) throw new Error('A configured PDP URL is required.');
    const isCartMutation = (request) =>
      request.method() === 'POST' &&
      /\/users\/current\/carts\/(?:current|[^/]+)\/entries(?:\?|$)/.test(request.url());

    const cartAlreadyHasSku = async ({ timeout = 8000, refresh = false } = {}) => {
      if (this.cartReadback) return this.cartReadback(this.page, { cartUrl: this.cartUrl, sku: this.sku, timeout });
      try {
        if (refresh || !new URL(this.page.url()).pathname.endsWith('/cart')) {
          await this.page.goto(this.cartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        await this.page.getByText(this.sku, { exact: true }).filter({ visible: true }).first()
          .waitFor({ state: 'visible', timeout });
        return true;
      } catch {
        return false;
      }
    };

    // A missed network event must not trigger another state-changing Add action.
    // Before every retry, prove the cart state first. Only re-click when the SKU
    // is still absent after a fresh cart readback.
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1 && await cartAlreadyHasSku({ timeout: 8000, refresh: true })) {
        diagnostics?.push({ attempt, checkpoint: 'recovered-from-cart-readback', url: this.page.url() });
        return;
      }

      const loadedPdp = this.reuseLoadedPdp && this.page.url() === String(this.pdpUrl) &&
        await this.page.getByText(this.sku, { exact: true }).first().isVisible();
      if (!loadedPdp) await this.safeGoto(this.pdpUrl);
      if (configureProduct) await configureProduct(this.page);

      const addButton = this.page
        .getByRole('main')
        .getByRole('button', { name: addButtonName })
        .filter({ visible: true })
        .first();

      let buttonReady = await addButton
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => true)
        .catch(() => false);

      if (!buttonReady && recoverBlankPdp && await recoverBlankPdp()) {
        buttonReady = await addButton.waitFor({ state: 'visible', timeout: 30000 })
          .then(() => true, () => false);
      }

      if (!buttonReady) {
        diagnostics?.push({ attempt, checkpoint: 'button-not-visible', url: this.page.url() });
        const unavailableText = await this.page.getByRole('main').innerText({ timeout: 5000 }).catch(() => '');
        if (unavailableText.includes(this.sku) && /Sold out\.\s*Get stock alert/i.test(unavailableText)) {
          const preorder = this.page.getByRole('main').getByRole('button', { name: /^Preventa$/i })
            .filter({ visible: true }).first();
          if (await preorder.isVisible() && await preorder.isEnabled()) {
            const error = new Error(`Configured product ${this.sku} exposes an enabled Preventa button; configure the native preorder action for this scenario.`);
            error.code = 'PRODUCT_PREORDER_AVAILABLE';
            error.sku = this.sku;
            throw error;
          }
          const error = new Error(`Configured product ${this.sku} is sold out; a currently purchasable fixture is required.`);
          error.code = 'PRODUCT_OUT_OF_STOCK';
          error.sku = this.sku;
          throw error;
        }
        if (attempt < maxAttempts) {
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          continue;
        }

        const mainText = await this.page
          .getByRole('main')
          .innerText({ timeout: 5000 })
          .catch(() => '');
        throw new Error(
          `AUTOMATION_RECOVERY_EXHAUSTED: configured PDP add-to-cart button was not rendered after bounded refresh recovery. ` +
          `url=${this.page.url()} title=${await this.page.title().catch(() => '')} ` +
          `main=${String(mainText || '').replace(/\s+/g, ' ').trim().slice(0, 500) || '<empty>'}`
        );
      }

      const mutationOutcome = waitForCartMutation
        ? Promise.race([
            this.page.waitForResponse(
              (response) => isCartMutation(response.request()),
              { timeout: 20000 }
            ).then((response) => ({ response })).catch(() => null),
            this.page.waitForEvent('requestfailed', {
              predicate: isCartMutation,
              timeout: 20000,
            }).then((request) => ({ failedRequest: request })).catch(() => null),
            this.page.waitForTimeout(20000).then(() => null),
          ])
        : Promise.resolve(null);

      diagnostics?.push({
        attempt,
        checkpoint: 'before-click',
        url: this.page.url(),
        button: await addButton.evaluate((button) => ({
          outerHTML: button.outerHTML.slice(0, 1200),
          disabled: button.disabled,
          ariaDisabled: button.getAttribute('aria-disabled'),
        })).catch(() => null),
      });
      await addButton.scrollIntoViewIfNeeded();
      try {
        await addButton.click({ timeout: 8000 });
      } catch (error) {
        if (!/intercepts pointer events/i.test(String(error?.message || ''))) throw error;
        await this.page.keyboard.press('Escape').catch(() => {});
        await addButton.scrollIntoViewIfNeeded();
        await addButton.focus();
        await addButton.press('Enter');
      }
      diagnostics?.push({ attempt, checkpoint: 'after-click', url: this.page.url() });

      const outcome = await mutationOutcome;
      diagnostics?.push({
        attempt,
        checkpoint: 'mutation-outcome',
        url: this.page.url(),
        status: outcome?.response?.status() ?? null,
        failedRequest: outcome?.failedRequest?.failure()?.errorText ?? null,
      });
      if (outcome?.response && !outcome.response.ok()) {
        throw new Error(`Configured PDP add-to-cart returned HTTP ${outcome.response.status()}.`);
      }
      if (this.cartReadback && outcome?.response) {
        if (await outcome.response.finished()) throw new Error('MX Add response was interrupted; Add will not be repeated.');
        const body = await outcome.response.json();
        if (body.statusCode !== 'success' || body.entry?.product?.code !== this.sku) {
          throw new Error('MX Add response did not confirm the configured product; Add will not be repeated.');
        }
      }

      if (await cartAlreadyHasSku({ timeout: 10000, refresh: true })) {
        diagnostics?.push({ attempt, checkpoint: 'cart-check', url: this.page.url(), cartContainsSku: true });
        return;
      }

      diagnostics?.push({ attempt, checkpoint: 'cart-check', url: this.page.url(), cartContainsSku: false });
      if (this.cartReadback && outcome?.response) {
        throw new Error('MX cart lost the configured product after acknowledged Add; Add will not be repeated.');
      }
      if (attempt === maxAttempts) {
        const failure = outcome?.failedRequest?.failure()?.errorText || 'no successful cart mutation or persisted cart state was observed';
        throw new Error(`AUTOMATION_RECOVERY_EXHAUSTED: cart did not contain ${this.sku} after one bounded refresh/retry cycle: ${failure}.`);
      }
    }
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
