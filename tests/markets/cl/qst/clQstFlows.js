import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";

export async function bootstrapClStorefront(page, config) {
  if (config.setupUrl) {
    await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText(/you can access pages now/i)
      .waitFor({ state: "visible", timeout: 8000 })
      .catch(() => {});
  }
  await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "My Profile", exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
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
  const resolved = await resolveProduct(page, config);
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
    cartPageTitlePattern: /Producto\(s\).*carrito|carrito/i,
    orderSummaryPattern: /Resumen/i,
    summaryProductPattern: /Producto/i,
    checkoutButtonPattern: /Continuar con la compra|checkout|comprar/i,
    guestEmailPattern: /correo electr[oó]nico|email/i,
    footerAccountPattern: /Account|Cuenta/i,
  });
}
