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

export async function validateMxExternalServicesPresentation(page) {
  const main = page.getByRole("main");
  const serviceLabels = ["Galaxy Canje", "Samsung Care+"];

  for (const serviceName of serviceLabels) {
    await expect(
      main.getByText(serviceName, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 30000 });
  }

  const addActions = main
    .getByText(/^Agregar ahora$/i, { exact: true })
    .filter({ visible: true });
  expect(await addActions.count()).toBeGreaterThanOrEqual(serviceLabels.length);
}

function parseMxCurrency(text) {
  const match = String(text || "").match(/\$\s*([\d,.]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

export async function validateMxCheckoutSummaryPresentation(page) {
  const summaryHeading = page.getByRole("heading", {
    name: "Resumen de tu pedido",
    level: 2,
  });
  const totalHeading = page.getByRole("heading", {
    name: "Total con IVA",
    level: 3,
  });

  await expect(summaryHeading).toBeVisible({ timeout: 30000 });
  await expect(totalHeading).toBeVisible({ timeout: 30000 });

  const summaryBlock = summaryHeading.locator(
    "xpath=ancestor::*[.//*[normalize-space()='Subtotal'] and .//*[normalize-space()='IVA']][1]"
  );
  await expect(summaryBlock).toBeVisible({ timeout: 30000 });

  const summaryText = await summaryBlock.innerText();
  const totalText = await totalHeading.locator("..").innerText();

  expect(summaryText).toMatch(/Subtotal/i);
  expect(summaryText).toMatch(/\bIVA\b/i);

  const subtotalMatch = summaryText.match(/Subtotal\s*\$\s*([\d,.]+)/i);
  const ivaMatch = summaryText.match(/\bIVA\s*\$\s*([\d,.]+)/i);
  const subtotal = parseMxCurrency(subtotalMatch ? `$${subtotalMatch[1]}` : "");
  const iva = parseMxCurrency(ivaMatch ? `$${ivaMatch[1]}` : "");
  const total = parseMxCurrency(totalText);

  expect(subtotal).not.toBeNull();
  expect(iva).not.toBeNull();
  expect(total).not.toBeNull();
  expect(subtotal).toBeGreaterThan(0);
  expect(iva).toBeGreaterThan(0);
  expect(total).toBeGreaterThan(0);

  return {
    subtotal,
    iva,
    total,
    voucherVisible: (await page.getByText(/Voucher|Cup[oó]n/i).filter({ visible: true }).count()) > 0,
    promoVisible: (await page.getByText(/Promoci[oó]n|Promo/i).filter({ visible: true }).count()) > 0,
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
