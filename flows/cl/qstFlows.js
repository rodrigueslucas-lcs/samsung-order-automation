import { test, expect } from "@playwright/test";
import ProductPage from "../../pages/ProductPage";
import CartPage from "../../pages/CartPage";
import clAuthStateModule from "../../utils/clAuthState";
import clStorefrontOverlays from "../../utils/clStorefrontOverlays";
import { attachNetworkEvidence } from "../../utils/networkEvidence";
import evidenceContext from "../../reporting/evidence/evidenceContext";

const { CL_AUTH_STATE_PATH, getClAuthState, hasClAuthState } = clAuthStateModule;
const { recordBusinessEvidence } = evidenceContext;

export async function selectClCheckoutOption(page, control, name) {
  await control.click();
  const option = page.locator(".cdk-overlay-pane:visible")
    .getByRole("option", { name }).filter({ visible: true }).first();
  await option.waitFor({ state: "visible", timeout: 30000 });
  await option.press("Enter");
  await expect(control).toContainText(name);
}

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
    const profile = page.getByRole("button", { name: "My Profile", exact: true })
      .or(page.locator('button[data-an-la="L0_13_login"], button.nv00-gnb-v4__utility-user'))
      .filter({ visible: true }).first();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await profile.waitFor({ state: "visible", timeout: 60000 });
        return;
      } catch (error) {
        const current = new URL(page.url());
        const main = page.getByRole("main");
        const banner = page.getByRole("banner");
        const empty = async locator => await locator.count() === 1 &&
          !(await locator.innerText()).trim();
        const body = await page.locator("body").innerText().catch(() => "unavailable");
        const blankShell = current.origin === config.baseUrl.origin &&
          /^stg2?\.shop\.samsung\.com$/.test(current.hostname) &&
          current.pathname.replace(/\/+$/, "") === config.baseUrl.pathname.replace(/\/+$/, "") &&
          await empty(main) && await empty(banner) &&
          !body.replace(/Skip to (?:Header|Main Content|Footer)/g, "").trim();
        if (attempt || !blankShell) throw error;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      }
    }
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
    const testInfo = test.info();
    recordBusinessEvidence(testInfo, {
      market: "CL",
      environment: config.environment,
      sku: resolved.sku,
      pdpUrl: resolved.pdpUrl.href,
    });
    await testInfo.attach("CL Product Context", {
      body: Buffer.from(JSON.stringify({
        market: "CL",
        environment: config.environment,
        sku: resolved.sku,
        pdpUrl: `${resolved.pdpUrl.origin}${resolved.pdpUrl.pathname}`,
      }, null, 2)),
      contentType: "application/json",
    });
    await bootstrapClStorefront(page, config);
    const product = new ProductPage(page, {
      setupUrl: config.setupUrl?.href || null,
      sku: resolved.sku,
      pdpUrl: resolved.pdpUrl.href,
      cartUrl: config.cartUrl.href,
    });
    const addResponse = page.waitForResponse((response) => {
      const request = response.request();
      const url = new URL(response.url());
      return request.method() === "POST" && /\/cl\/users\/[^/]+\/carts\/[^/]+\/entries(?:\/|$)/i.test(url.pathname);
    }, { timeout: 60000 }).catch(() => null);
    await product.addConfiguredPdpToCart({ waitForCartMutation: true });
    const response = await addResponse;
    if (response) await attachNetworkEvidence(testInfo, "Add to Cart", { response });
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
