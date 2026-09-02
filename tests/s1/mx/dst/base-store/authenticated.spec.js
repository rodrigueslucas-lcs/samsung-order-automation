import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";
import { test, expect } from "./mx.auth.fixture";

test.describe.configure({ timeout: 300000 });

function configuredProduct(page, config) {
  return new ProductPage(page, {
    setupUrl: config.bootstrapUrl.toString(),
    sku: config.sku,
    pdpUrl: config.pdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
}

function configuredCart(page, config) {
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

test("MX TC1 TC2 authenticated subset @dst @mx @registered - saved Samsung Account session is active from Home", async ({ page, mxConfig }) => {
  test.setTimeout(180000);
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
  const profile = page.getByRole("button", { name: "My Profile", exact: true });
  await profile.hover();
  await expect(
    page.getByRole("link", { name: /^Cerrar Sesi[oó]n$/i }).filter({ visible: true })
  ).toBeVisible();
});

test("MX TC12 authenticated subset @dst @mx @registered - My Orders staging route is available", async ({ page, mxConfig }) => {
  test.setTimeout(180000);
  await page.goto(`${mxConfig.baseUrl.origin}/mx/mypage/orders`, {
    waitUntil: "domcontentloaded",
  });
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
  await expect(page.getByText("Mis pedidos", { exact: true }).filter({ visible: true }).first()).toBeVisible({
    timeout: 60000,
  });
});

test("MX TC3 TC5 authenticated subset @dst @mx @registered - registered Cart reaches Checkout without Guest login", async ({ page, mxConfig }) => {
  test.setTimeout(300000);
  await configuredProduct(page, mxConfig).addConfiguredPdpToCart();
  const cart = configuredCart(page, mxConfig);
  await cart.proceedToAuthenticatedCheckout();
  await page.waitForURL(/CHECKOUT_STEP_(?:CONTACT_INFO|DELIVERY|PAYMENT)/, { timeout: 60000 });
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
  await expect(page.getByRole("button", { name: /Continuar como (usuario )?invitado/i })).toHaveCount(0);
});

test("MX registered checkout preflight @dst @mx @registered - reaches Delivery without account persistence", async ({ page, mxConfig }) => {
  test.setTimeout(420000);
  await configuredProduct(page, mxConfig).addConfiguredPdpToCart();
  await configuredCart(page, mxConfig).proceedToAuthenticatedCheckout();
  const checkout = new MxCheckoutPage(page);
  await checkout.fillRegisteredContact({
    firstName: "MX",
    lastName: "Automation",
    phone: "5512345678",
  });
  await checkout.fillDelivery(
    { postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" },
    { registered: true }
  );
  const saveAddress = page
    .getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o)/i })
    .filter({ visible: true });
  for (let index = 0; index < await saveAddress.count(); index += 1) {
    await expect(saveAddress.nth(index)).not.toBeChecked();
  }
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/);
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
});
