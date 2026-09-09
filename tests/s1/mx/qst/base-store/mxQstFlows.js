import { expect } from "@playwright/test";
import CartPage from "../../../../../pages/CartPage";
import ProductPage from "../../../../../pages/ProductPage";
import cartPresentation from "../../../../../flows/smb/cartPresentation";

const { validateCartItemPresentation, validateStickyControl } = cartPresentation;

export function mxQstCart(page, config) {
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

export async function openMxQstPdp(page, config) {
  await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  await page.goto(config.pdpUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/mx/p/${config.sku}`, "i"));
  await expect(page.getByText(config.sku, { exact: true }).first()).toBeVisible({ timeout: 60000 });
}

export async function prepareMxQstCart(page, config) {
  const cart = mxQstCart(page, config);
  await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  await cart.clearMxCartAndConfirmEmpty();
  await openMxQstPdp(page, config);

  const storage = page.getByRole("button", { name: "512GB", exact: true });
  await expect(storage).toBeVisible({ timeout: 30000 });
  if (!/\bselected\b/.test((await storage.getAttribute("class")) || "")) {
    await storage.click();
  }

  const product = new ProductPage(page, {
    setupUrl: config.bootstrapUrl.toString(),
    sku: config.sku,
    pdpUrl: config.pdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
  await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  await cart.validateControlledSingleSku(config.sku);
  return cart;
}

export async function validateMxCartProductPresentation(page, config) {
  return validateCartItemPresentation(page, {
    sku: config.sku,
    currencyPattern: /\$\s*[\d,.]+/,
  });
}

function parseMxCurrency(text) {
  const match = String(text || "").match(/\$\s*([\d,.]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

export async function validateMxCheckoutSummaryPresentation(page, config) {
  const sku = page.getByText(config.sku, { exact: true }).filter({ visible: true }).first();
  await expect(sku).toBeVisible({ timeout: 30000 });

  const subtotalLabel = page.getByText(/^Subtotal$/i).filter({ visible: true }).first();
  const totalLabel = page
    .getByText(/^Total(?:\s+con\s+IVA)?$/i)
    .filter({ visible: true })
    .first();
  await expect(subtotalLabel).toBeVisible({ timeout: 30000 });
  await expect(totalLabel).toBeVisible({ timeout: 30000 });

  const subtotalText = await subtotalLabel.locator("..").innerText();
  const totalText = await totalLabel.locator("..").innerText();
  const subtotal = parseMxCurrency(subtotalText);
  const total = parseMxCurrency(totalText);

  expect(subtotal).not.toBeNull();
  expect(total).not.toBeNull();
  expect(subtotal).toBeGreaterThan(0);
  expect(total).toBeGreaterThan(0);

  const optionalVoucher = page
    .getByText(/Voucher|Cup[oó]n/i)
    .filter({ visible: true });
  const optionalPromo = page
    .getByText(/Promoci[oó]n|Promo/i)
    .filter({ visible: true });

  return {
    subtotal,
    total,
    voucherVisible: (await optionalVoucher.count()) > 0,
    promoVisible: (await optionalPromo.count()) > 0,
  };
}

export { validateStickyControl };

export async function openMxService(page, name) {
  const button = page.getByRole("button", {
    name: new RegExp(`Agregar ahora\\s*${name}`, "i"),
  });
  await expect(button).toBeVisible({ timeout: 30000 });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const surface = page.getByRole("dialog").filter({ visible: true }).or(
    page.locator("[role='presentation']:visible").filter({ hasText: new RegExp(name, "i") })
  ).first();
  await expect(page.getByText(new RegExp(name, "i")).filter({ visible: true }).last()).toBeVisible({
    timeout: 30000,
  });
  return surface;
}
