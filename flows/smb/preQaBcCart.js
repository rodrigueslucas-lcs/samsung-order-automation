import { chromium, expect, test } from "@playwright/test";

const PREQA_ORIGIN = "https://p6-pre-qa2.samsung.com";

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
    await test.step("Open the authenticated PreQA BC catalog and its controlled product", async () => {
      await page.goto(plp.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await dismissBanner();
      await expect(page).toHaveURL(plp.href, { timeout: 30000 });
      const card = page.locator('[role="listitem"].pd21-product-card__item')
        .filter({ has: page.locator(`a.pd21-product-card__name[data-modelcode="${sku}"]`) }).first();
      await card.scrollIntoViewIfNeeded({ timeout: 60000 });
      await expect(card).toBeVisible({ timeout: 60000 });
      const product = card.locator(`a.pd21-product-card__name[data-modelcode="${sku}"]`).first();
      const destination = new URL(await product.getAttribute("href"), plp);
      expect(destination.origin, "BC PDP must not navigate to Production.").toBe(PREQA_ORIGIN);
      expect(destination.pathname).toMatch(new RegExp(`^/${market}/`));
      await product.click();
      await expect(page).toHaveURL(destination.href, { timeout: 60000 });
      await dismissBanner();
    });
    const pdp = page.url();
    const handle = await page.waitForFunction(market => performance.getEntriesByType("resource")
      .map(entry => entry.name).find(url => new URL(url).pathname === `/tokocommercewebservices/v2/${market}/minicart/totalProducts`), market, { timeout: 30000 });
    const countUrl = await handle.jsonValue();
    const endpoint = new URL(countUrl);
    if (!['s2-api-cdn.ecom-stg.samsung.com', 's2-smb-api-cdn.ecom-stg.samsung.com'].includes(endpoint.hostname)) {
      throw new Error("BC minicart must use the observed staging commerce API.");
    }
    const readCount = async () => {
      const response = await context.request.get(countUrl);
      expect(response.ok(), "PreQA minicart request must succeed.").toBe(true);
      const count = Number((await response.text()).match(/<Integer>(\d+)<\/Integer>/i)?.[1]);
      expect(Number.isFinite(count), "PreQA minicart must return a numeric count.").toBe(true);
      return count;
    };
    const before = await readCount();
    let mutation;
    await test.step("Add the controlled BC product and prove the minicart increases", async () => {
      const add = page.locator(`[data-modelcode="${sku}"][canaddtocart="true"]`)
        .filter({ visible: true }).filter({ hasText: /Agregar al carrito/i }).first();
      await expect(add, "PreQA PDP must offer this model as purchasable.").toBeVisible({ timeout: 30000 });
      const pending = page.waitForResponse(response => response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/addToCart/multi/"), { timeout: 30000 });
      await add.click();
      mutation = await pending;
      expect(mutation.ok(), "BC Add to Cart mutation must succeed.").toBe(true);
      await expect.poll(readCount, { timeout: 30000, message: "BC Add to Cart must increase the observed minicart count." }).toBeGreaterThan(before);
    });
    const after = await readCount();
    await page.goto(pdp, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dismissBanner();
    await expect(page).toHaveURL(pdp, { timeout: 30000 });
    await expect.poll(readCount, { timeout: 15000 }).toBe(after);
    return { source: "PreQA BC catalog -> PDP", market, modelCode: sku, plpPath: plp.pathname,
      pdpPath: new URL(pdp).pathname, commerceOrigin: endpoint.origin, commerceEnvironment: "S2",
      cartCountBefore: before, cartCountAfter: after, addToCartStatus: mutation.status() };
  } finally {
    if (page) {
      const finalUrl = new URL(page.url());
      if (finalUrl.origin === PREQA_ORIGIN && finalUrl.pathname.startsWith(`/${market}/`)) {
        await page.screenshot({ fullPage: false }).then(body => testInfo.attach("preqa-bc-screenshot", { body, contentType: "image/png" })).catch(() => {});
      }
      await page.close().catch(() => {});
    }
    await browser.close();
  }
}
