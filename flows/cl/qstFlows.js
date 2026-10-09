import { test } from "@playwright/test";
import ProductPage from "../../pages/ProductPage";
import CartPage from "../../pages/CartPage";
import clAuthStateModule from "../../utils/clAuthState";
import clStorefrontOverlays from "../../utils/clStorefrontOverlays";

const { CL_AUTH_STATE_PATH, getClAuthState, hasClAuthState } = clAuthStateModule;

export async function bootstrapClStorefront(page, config) {
  await test.step("Bootstrap the CL storefront and wait for the header to become interactive", async () => {
    await clStorefrontOverlays.installClChatNoticeDismissal(page);
    if (config.setupUrl) {
      await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByText(/you can access pages now/i)
        .waitFor({ state: "visible", timeout: 8000 })
        .catch(() => {});
    }
    await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: "My Profile", exact: true })
      .waitFor({ state: "visible", timeout: 60000 });
  });
}

export function hasClRegisteredSession() {
  return hasClAuthState();
}

export async function openAuthenticatedClPage(browser, config) {
  if (!hasClAuthState()) {
    throw new Error(`CL registered auth state is missing: ${CL_AUTH_STATE_PATH}`);
  }

  return test.step("Open and validate an authenticated CL storefront session", async () => {
    const context = await browser.newContext({ storageState: CL_AUTH_STATE_PATH });
    const auth = getClAuthState();
    await auth.applyAuthSessionStorage(context);
    const page = await context.newPage();
    await bootstrapClStorefront(page, config);
    await auth.validateAuthenticatedSession(page);
    return { context, page, auth };
  });
}

async function resolveProduct(page, config) {
  if (config.pdpUrl && config.sku) return { pdpUrl: config.pdpUrl, sku: config.sku };
  await bootstrapClStorefront(page, config);
  const href = await page.locator('a[href*="/cl/p/"]').evaluateAll((links) =>
    links.map((a) => a.href).find(Boolean) || null
  );
  if (!href) {
    throw new Error("No CL PDP link was discoverable. Set CL_QST_PDP_URL and CL_QST_SKU to a verified Chile product.");
  }
  const pdpUrl = new URL(href);
  const match = pdpUrl.pathname.match(/\/cl\/p\/([^/?#]+)/i);
  if (!match) throw new Error("Discovered CL PDP did not expose a /cl/p/<sku> route.");
  return { pdpUrl, sku: decodeURIComponent(match[1]) };
}

export async function addConfiguredProductToClCart(page, config) {
  return test.step("Add the configured CL product to cart and wait for the cart mutation", async () => {
    const resolved = await resolveProduct(page, config);
    await bootstrapClStorefront(page, config);
    const product = new ProductPage(page, {
      setupUrl: config.setupUrl?.href || null,
      sku: resolved.sku,
      pdpUrl: resolved.pdpUrl.href,
      cartUrl: config.cartUrl.href,
    });
    await product.addConfiguredPdpToCart({ waitForCartMutation: true });
    return new CartPage(page, {
      cartUrl: config.cartUrl.href,
      sku: resolved.sku,
      productNamePattern: null,
      currencyPattern: /\$\s*[\d.,]+/,
      cartPageTitlePattern: /Tienes\s+\d+\s+producto(?:s)?\s+en\s+tu\s+carro/i,
      orderSummaryPattern: /Resumen/i,
      summaryProductPattern: null,
      checkoutButtonPattern: /^Continuar$/i,
      guestEmailPattern: /Ingresa tu correo|correo electr[oó]nico|email/i,
      footerAccountPattern: /Account|Cuenta/i,
    });
  });
}
