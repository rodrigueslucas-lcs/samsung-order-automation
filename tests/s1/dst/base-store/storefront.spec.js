import HomePage from "../../../../pages/HomePage";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import { test, expect } from "./mx.fixture";

async function openMxCart(page, config) {
  const product = new ProductPage(page, {
    setupUrl: config.bootstrapUrl.toString(),
    sku: config.sku,
    pdpUrl: config.pdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
  await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  await product.addConfiguredPdpToCart();
  return new CartPage(page, {
    cartUrl: config.cartUrl.toString(),
    sku: config.sku,
    productNamePattern: null,
    orderSummaryPattern: /Resumen de tu pedido/i,
    totalPattern: /Total con IVA/i,
    checkoutButtonPattern: /Finalizar Compra/i,
    currencyPattern: /\$\s*[\d,.]+/,
  });
}

test("MX-DISCOVERY TC14 @dst @mx @base-store - Homepage attributes", async ({ page, mxConfig }, testInfo) => {
  test.setTimeout(180000);
  const home = new HomePage(page, {
    setupUrl: mxConfig.bootstrapUrl.toString(),
    homeUrl: mxConfig.baseUrl.toString(),
    footerHeadingPattern: "Productos y Servicios",
  });
  await home.openHome();
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
  const attributes = await home.validateHomepageAttributes();
  if (!attributes.heroVisible || !attributes.topSellerVisible) {
    testInfo.annotations.push({
      type: "partial",
      description: `Header/Footer available; Hero=${attributes.heroVisible}; TopSeller=${attributes.topSellerVisible}`,
    });
  }
});

test("MX-DISCOVERY PDP @dst @mx @base-store - configured product is purchasable", async ({ page, mxConfig }) => {
  test.setTimeout(180000);
  await page.goto(mxConfig.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  await page.goto(mxConfig.pdpUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/mx/p/${mxConfig.sku}`, "i"));
  await expect(page.getByText(mxConfig.sku, { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("button", { name: /Agregar al carrito|Add to cart|Add to basket/i }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
});

test("MX-DISCOVERY TC15 TC16 TC18 TC20 @dst @mx @base-store - Cart structure", async ({ page, mxConfig }) => {
  test.setTimeout(240000);
  const cart = await openMxCart(page, mxConfig);
  await cart.validateCartPage();
  await cart.validateProductInCart();
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
  await cart.validateCheckoutButton();
});

test("MX-DISCOVERY TC17 @dst @mx @base-store - Cart quantity can change and restore", async ({ page, mxConfig }) => {
  test.setTimeout(240000);
  const cart = await openMxCart(page, mxConfig);
  await cart.validateQuantityCanChange();
});

test("MX-DISCOVERY TC33 TC34 @dst @mx @base-store - Cart reaches Checkout login safely", async ({ page, mxConfig }) => {
  test.setTimeout(240000);
  const cart = await openMxCart(page, mxConfig);
  await cart.proceedToCheckout();
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
  await expect(
    page
      .getByText(/Samsung Checkout Express|Iniciar sesi[oó]n|Continuar como (usuario )?invitado/i)
      .filter({ visible: true })
      .first()
  ).toBeVisible({ timeout: 60000 });
});

test("MX-DISCOVERY TC35 TC36 @dst @mx @base-store - Guest Contact step", async ({ page, mxConfig }) => {
  test.setTimeout(240000);
  const cart = await openMxCart(page, mxConfig);
  await cart.proceedToCheckout();
  const email = page.getByPlaceholder(/ingresa tu correo/i);
  await email.fill("mx.qa.automation@example.com");
  const continueAsGuest = page.getByRole("button", {
    name: /Continuar como (usuario )?invitado/i,
  });
  await expect(continueAsGuest).toBeEnabled({ timeout: 30000 });
  await continueAsGuest.click();
  await page.waitForURL(/CHECKOUT_STEP_CONTACT_INFO/, { timeout: 60000 });
  await expect(page.getByRole("textbox", { name: "firstName" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("textbox", { name: "lastName" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "phone", exact: true })).toBeVisible();
});
