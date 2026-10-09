import { expect } from "@playwright/test";
import ProductPage from "../pages/ProductPage";
import CartPage from "../pages/CartPage";

const CODE_INPUT = /verification|verify|access|code|c[oó]digo|clave|password/i;
const CODE_BUTTON = /verify|continue|enter|submit|access|ingresar|continuar|validar|acceder/i;

export async function openEppStore(page, cfg) {
  await page.goto(cfg.entryUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });

  if (cfg.accessMode === "verification-code" && cfg.verificationCode) {
    const candidate = page.getByRole("textbox", { name: CODE_INPUT })
      .or(page.getByPlaceholder(CODE_INPUT))
      .or(page.locator('input[type="password"]'))
      .filter({ visible: true })
      .first();

    if (await candidate.isVisible().catch(() => false)) {
      await candidate.fill(cfg.verificationCode);
      const submit = page.getByRole("button", { name: CODE_BUTTON }).filter({ visible: true }).first();
      if (await submit.isVisible().catch(() => false)) await submit.click();
      else await candidate.press("Enter");
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
  }

  if (cfg.accessMode === "corporate-email-link") {
    const email = page.locator('input[type="email"]:visible').first();
    if (await email.isVisible().catch(() => false)) {
      throw new Error(`${cfg.market} ${cfg.environment} EPP requires corporate-email activation before automation can continue. ${cfg.note || ""}`.trim());
    }
  }

  await expect(page.locator("body")).toBeVisible({ timeout: 60000 });
  const body = (await page.locator("body").innerText().catch(() => "")).trim();
  if (!body) throw new Error(`${cfg.market} EPP storefront loaded without visible body content.`);
}

export async function addConfiguredEppProduct(page, cfg, { currencyPattern = /[$S/]\s*[\d.,]+/ } = {}) {
  if (!cfg.pdpUrl || !cfg.sku) {
    throw new Error(`${cfg.market} ${cfg.environment} EPP needs ${cfg.market}_EPP_QST_PDP_URL and ${cfg.market}_EPP_QST_SKU for product/cart scenarios.`);
  }
  await openEppStore(page, { ...cfg, entryUrl: cfg.pdpUrl });
  const product = new ProductPage(page, {
    setupUrl: null,
    sku: cfg.sku,
    pdpUrl: cfg.pdpUrl.href,
    cartUrl: cfg.cartUrl.href,
  });
  await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  return new CartPage(page, {
    cartUrl: cfg.cartUrl.href,
    sku: cfg.sku,
    productNamePattern: null,
    currencyPattern,
  });
}

export async function validateEppCartUi(cart) {
  await cart.validateProductInCart();
  await cart.validateOrderSummary();
  await cart.validateCartFooter();
}

export async function validateBackToTop(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const control = page.getByRole("button", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i })
    .or(page.getByRole("link", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i }))
    .filter({ visible: true }).first();
  await expect(control).toBeVisible({ timeout: 30000 });
  await control.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBeLessThan(250);
}
