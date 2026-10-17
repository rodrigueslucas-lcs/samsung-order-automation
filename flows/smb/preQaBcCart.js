import { chromium, expect, test } from "@playwright/test";

const PREQA_ORIGIN = "https://p6-pre-qa2.samsung.com";
const SHOP_ORIGIN = "https://stg2.shop.samsung.com";
const COMMERCE_HOSTS = new Set(['s2-api-cdn.ecom-stg.samsung.com', 's2-smb-api-cdn.ecom-stg.samsung.com']);

export async function addProductFromPreQaBc({ market, sku, plpPath, testInfo }) {
  if (!/^[a-z]{2}$/.test(market) || !/^[a-z0-9-]+$/i.test(sku)) throw new Error("Invalid BC market or model code.");
  const plp = new URL(plpPath, PREQA_ORIGIN);
  if (plp.origin !== PREQA_ORIGIN || !plp.pathname.startsWith(`/${market}/`)) {
    throw new Error("BC catalog must remain on the market's authenticated PreQA origin.");
  }
  const browser = await chromium.connectOverCDP(process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223");
  let page;
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("Keep the authenticated PreQA bootstrap browser open.");
    page = await context.newPage();
    await page.bringToFront();
    await page.route("**/tokocommercewebservices/**", route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method()) && !COMMERCE_HOSTS.has(new URL(request.url()).hostname)) {
        return route.abort();
      }
      return route.continue();
    });
    const cartUrl = `${SHOP_ORIGIN}/${market}/cart`;
    const main = page.getByRole("main");
    const quantity = () => main.locator('cx-cart-item-v2')
      .filter({ has: page.getByText(sku, { exact: true }) }).first()
      .getByRole("textbox", { name: "Quantity", exact: true });
    let before = 0;
    await test.step("Bootstrap the S2 destination and read the controlled SKU quantity", async () => {
      await page.goto(`${SHOP_ORIGIN}/getcookie.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByText(/You can access pages now/i).waitFor({ timeout: 30000 });
      await page.goto(cartUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).toHaveURL(cartUrl, { timeout: 30000 });
      await Promise.race([
        main.getByRole("textbox", { name: "Quantity", exact: true }).first().waitFor({ state: "visible", timeout: 60000 }),
        main.getByRole("heading", { name: /carrito.*vac[ií]o|no hay productos/i }).waitFor({ state: "visible", timeout: 60000 }),
      ]);
      if (await quantity().count()) {
        before = Number(await quantity().inputValue());
        expect(Number.isInteger(before) && before > 0).toBe(true);
      }
    });
    const dismissBanner = async () => {
      const button = page.getByRole("button", { name: /^Continuar$/i }).filter({ visible: true }).first();
      const box = await button.boundingBox().catch(() => null);
      const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      // The country selector remains in the DOM translated outside the screen
      // after dismissal. Only operate its real, on-screen banner.
      if (box && box.x >= 0 && box.y >= 0 && box.x < viewport.width && box.y < viewport.height) {
        await button.click({ timeout: 5000 });
      }
    };
    let card;
    let pdpPath;
    await test.step("Open the authenticated PreQA BC catalog and its controlled product", async () => {
      await page.goto(plp.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await dismissBanner();
      await expect(page).toHaveURL(plp.href, { timeout: 30000 });
      card = page.locator('[role="listitem"].pd21-product-card__item')
        .filter({ has: page.locator(`a.pd21-product-card__name[data-modelcode="${sku}"]`) }).first();
      await card.scrollIntoViewIfNeeded({ timeout: 60000 });
      await expect(card).toBeVisible({ timeout: 60000 });
      const product = card.locator(`a.pd21-product-card__name[data-modelcode="${sku}"]`).first();
      const destination = new URL(await product.getAttribute("href"), plp);
      expect(destination.origin, "BC PDP must not navigate to Production.").toBe(PREQA_ORIGIN);
      expect(destination.pathname).toMatch(new RegExp(`^/${market}/`));
      pdpPath = destination.pathname;
    });
    let mutation;
    await test.step("Add from the BC card and prove the intended SKU increases in the S2 cart", async () => {
      const add = card.getByText("Agregar al carrito", { exact: true });
      await expect(add, "The controlled BC card must offer Add to Cart.").toBeVisible({ timeout: 30000 });
      const pending = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === "POST" && COMMERCE_HOSTS.has(url.hostname) &&
          url.pathname === `/tokocommercewebservices/v2/${market}/addToCart/multi/`;
      }, { timeout: 30000 });
      await add.click();
      mutation = await pending;
      expect(mutation.ok(), "BC Add to Cart mutation must succeed.").toBe(true);
      await expect(page, "BC Add to Cart must reach the real cart, not SystemParking.").toHaveURL(cartUrl, { timeout: 60000 });
      await expect(quantity(), "The selected BC SKU must increase by one in the cart.")
        .toHaveValue(String(before + 1), { timeout: 60000 });
    });
    await test.step("Reload the S2 cart and prove the added SKU quantity persists", async () => {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).toHaveURL(cartUrl, { timeout: 30000 });
      await expect(quantity()).toHaveValue(String(before + 1), { timeout: 60000 });
    });
    return { source: "PreQA BC card -> S2 storefront cart", market, modelCode: sku, plpPath: plp.pathname,
      pdpPath, commerceOrigin: new URL(mutation.url()).origin, commerceEnvironment: "S2",
      skuQuantityBefore: before, skuQuantityAfter: before + 1, addToCartStatus: mutation.status() };
  } finally {
    if (page) {
      const finalUrl = new URL(page.url());
      if ([PREQA_ORIGIN, SHOP_ORIGIN].includes(finalUrl.origin) && finalUrl.pathname.startsWith(`/${market}/`)) {
        await page.screenshot({ fullPage: false }).then(body => testInfo.attach("preqa-bc-screenshot", { body, contentType: "image/png" })).catch(() => {});
      }
      await page.close().catch(() => {});
    }
    await browser.close();
  }
}
