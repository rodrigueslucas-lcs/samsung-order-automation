import { chromium } from "@playwright/test";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

const PRE_QA_ORIGIN = "https://p6-pre-qa2.samsung.com";
const PRE_QA_PLP = `${PRE_QA_ORIGIN}/mx/smartphones/all-smartphones/`;
const PRE_QA_MODEL_CODE = "SM-F766BLGKLTM";
const PRE_QA_PRODUCT_NAME = "Galaxy Z Flip7";
const PRE_QA_PDP_PATH = "/mx/smartphones/galaxy-z-flip7/buy/";
const PRE_QA_CDP_URL = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";
const PRE_QA_PDP_URL = new RegExp("p6-pre-qa2\\.samsung\\.com/mx/smartphones/galaxy-z-flip7/buy", "i");

async function dismissLocationBanner(page) {
  const continueButton = page.getByRole("button", { name: /Continuar/i }).filter({ visible: true });
  if (await continueButton.count()) {
    await continueButton.first().click().catch(() => {});
  }
}

async function getAuthenticatedPreQaPage() {
  const cdpBrowser = await chromium.connectOverCDP(PRE_QA_CDP_URL);
  const contexts = cdpBrowser.contexts();
  if (!contexts.length) {
    await cdpBrowser.close();
    throw new Error(`No Chrome context found at ${PRE_QA_CDP_URL}. Keep the authenticated PreQA2 bootstrap Chrome open.`);
  }

  const context = contexts[0];
  const page = await context.newPage();
  const buyingToolErrors = new Set();
  page.on("pageerror", error => {
    // Keep only known, non-sensitive frontend signatures in the evidence.
    for (const key of ["rewardsGrid", "checkSignIn"]) {
      if (error.message.includes(key)) buyingToolErrors.add(key);
    }
  });
  await page.bringToFront();
  await page.route("**/tokocommercewebservices/**", route => {
    const request = route.request();
    const allowed = ["s2-api-cdn.ecom-stg.samsung.com", "s2-smb-api-cdn.ecom-stg.samsung.com"];
    return !["GET", "HEAD"].includes(request.method()) && !allowed.includes(new URL(request.url()).hostname)
      ? route.abort() : route.continue();
  });
  return { cdpBrowser, page, buyingToolErrors };
}

async function returnToPreQaPdp(page) {
  const expected = PRE_QA_PDP_URL;
  if (expected.test(page.url())) {
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await dismissLocationBanner(page);
    return;
  }

  // The Add-to-Cart experience can transiently navigate through maintenance or
  // another PreQA route. Prefer browser history because the immediately prior
  // stable page is the PDP. If history does not restore it, perform one bounded
  // direct navigation. Do not spend the full test timeout on an unhealthy route.
  await page.goBack({ waitUntil: "commit", timeout: 30000 }).catch(() => null);

  if (!expected.test(page.url())) {
    await page.goto(`${PRE_QA_ORIGIN}${PRE_QA_PDP_PATH}`, {
      waitUntil: "commit",
      timeout: 30000,
    });
  }

  await expect(page).toHaveURL(expected, { timeout: 30000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissLocationBanner(page);
}

async function waitForPreQaAddToCart(page, testInfo) {
  const addToCart = page.getByRole("button", {
    name: /Añadir al carrito|Agregar al carrito|Add to cart|Add to bag/i,
  }).filter({ visible: true }).first();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!PRE_QA_PDP_URL.test(page.url())) await returnToPreQaPdp(page);
    await expect(page.getByText(PRE_QA_PRODUCT_NAME, { exact: true }).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await addToCart.waitFor({ state: "visible", timeout: 15000 }).then(() => true, () => false)) {
      return addToCart;
    }
    if (attempt === 0) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await dismissLocationBanner(page);
    }
  }

  const url = page.url();
  const title = await page.title().catch(() => "unavailable");
  const buttons = await page.getByRole("button").filter({ visible: true }).allTextContents()
    .then((values) => values.map((value) => value.trim()).filter(Boolean).slice(0, 20), () => []);
  await testInfo.attach("preqa-cdp-add-to-cart-missing", {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  }).catch(() => {});
  throw new Error(`PreQA Add to Cart is absent after one pre-submit PDP reload. URL=${url}; title=${title}; visibleButtons=${JSON.stringify(buttons)}`);
}

test.describe.configure({ timeout: 420000 });
// This test drives a separate authenticated CDP tab. The default page fixture
// stays on S2, so its automatic screenshot is unrelated to the BC scenario.
test.use({ screenshot: "off" });

test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24969"));

  const { cdpBrowser, page, buyingToolErrors } = await getAuthenticatedPreQaPage();
  const cartUrl = "https://stg2.shop.samsung.com/mx/cart";
  const quantity = () => page.getByRole("main").locator("cx-cart-item-v2")
    .filter({ has: page.getByText(PRE_QA_MODEL_CODE, { exact: true }) }).first()
    .getByRole("textbox", { name: "Quantity", exact: true });
  let cartCountBefore = 0;

  try {
    await test.step("Bootstrap S2 and read the selected SKU quantity before BC add", async () => {
      await page.goto("https://stg2.shop.samsung.com/getcookie.html", { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 30000 });
      await page.goto(cartUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).toHaveURL(cartUrl);
      await Promise.race([
        page.getByRole("main").getByRole("textbox", { name: "Quantity", exact: true }).first().waitFor({ timeout: 60000 }),
        page.getByRole("heading", { name: /carrito.*vac[ií]o|no hay productos/i }).waitFor({ timeout: 60000 }),
      ]);
      if (await quantity().count()) {
        cartCountBefore = Number(await quantity().inputValue());
        expect(Number.isInteger(cartCountBefore) && cartCountBefore > 0).toBe(true);
      }
    });
    await test.step("Open the authenticated PreQA BC product listing", async () => {
      await page.goto(PRE_QA_PLP, { waitUntil: "domcontentloaded", timeout: 60000 });
      await dismissLocationBanner(page);

      if (/\/apps\/samsung\/login\//i.test(page.url())) {
        throw new Error(
          `The Chrome attached at ${PRE_QA_CDP_URL} is not authenticated for PreQA2. Keep the WMC-authenticated preqa2:bootstrap Chrome open.`
        );
      }

      await expect(page).toHaveURL(new RegExp("p6-pre-qa2\\.samsung\\.com/mx/smartphones/all-smartphones", "i"), { timeout: 30000 });
    });

    await test.step("Open the configured Galaxy Z Flip7 PDP from the BC catalog", async () => {
      const productCard = page.locator("[role='listitem'].pd21-product-card__item")
        .filter({ has: page.locator(`a.pd21-product-card__name[data-modelcode='${PRE_QA_MODEL_CODE}']`) })
        .first();
      // The filter label includes its active count (for example "Filtros (1)").
      // Readiness is the exact product card rather than incidental filter copy.
      await expect(productCard, "The PreQA BC catalog must render the configured Galaxy Z Flip7 product card.")
        .toBeVisible({ timeout: 60000 });
      await productCard.scrollIntoViewIfNeeded();
      const productLink = productCard.locator(`a.pd21-product-card__name[data-modelcode='${PRE_QA_MODEL_CODE}']`);
      const detailsUrl = new URL(await productLink.getAttribute("href"), PRE_QA_ORIGIN);
      expect(detailsUrl.origin).toBe(PRE_QA_ORIGIN);
      await productLink.click();
      await page.waitForURL(detailsUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      const buyingLink = page.locator(`a[href='${PRE_QA_PDP_PATH}']`).filter({ visible: true }).first();
      const buyingUrl = new URL(await buyingLink.getAttribute("href"), PRE_QA_ORIGIN);
      expect(buyingUrl.origin).toBe(PRE_QA_ORIGIN);
      // This link is also handled by the storefront SPA, which renders a shell
      // without the AEM buying tool. Load its actual catalog URL as a document.
      await page.goto(buyingUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });

      await page.waitForURL((url) =>
        url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes(PRE_QA_PDP_PATH),
        { waitUntil: "domcontentloaded", timeout: 60000 }
      );
      await dismissLocationBanner(page);
      await expect(page.getByText(PRE_QA_PRODUCT_NAME, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
    });

    let addResponse;

    await test.step("Add the BC product and prove its quantity in the S2 cart", async () => {
      const noTradeIn = page.getByRole("button", { name: /No, gracias/i }).first();
      const choicesReady = await noTradeIn.waitFor({ state: "visible", timeout: 30000 })
        .then(() => true, () => false);
      if (!choicesReady) {
        throw new Error(`MX PreQA buying tool did not render its required Canje choice before Add to Cart. Observed frontend error signatures: ${JSON.stringify([...buyingToolErrors])}. No Add request was submitted.`);
      }
      await noTradeIn.click();
      // Declining Galaxy Canje does not resolve the mandatory Care+ choice.
      // Explicitly opt out so the buying tool enables this product's CTA.
      const noCare = page.getByRole("tab", { name: /Sin protecci[oó]n para mi Galaxy/i });
      await expect(noCare).toBeVisible({ timeout: 30000 });
      await noCare.click();
      await expect(page.locator('[canaddtocart="true"]').filter({ visible: true }).first(),
        "The configured PreQA product must become purchasable after declining Galaxy Canje and Care+.")
        .toBeVisible({ timeout: 30000 });
      const addToCart = await waitForPreQaAddToCart(page, testInfo);
      await expect(addToCart).toHaveAttribute("data-modelcode", PRE_QA_MODEL_CODE);
      await expect(addToCart).toHaveAttribute("canaddtocart", "true");
      const addResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === "POST" &&
          ["s2-api-cdn.ecom-stg.samsung.com", "s2-smb-api-cdn.ecom-stg.samsung.com"].includes(url.hostname) &&
          url.pathname === "/tokocommercewebservices/v2/mx/addToCart/multi/";
      }, { timeout: 30000 });
      await addToCart.click();
      addResponse = await addResponsePromise;
      expect(addResponse.ok(), "The actual S2 Add to Cart mutation must succeed.").toBe(true);
      await expect(page).toHaveURL(cartUrl, { timeout: 60000 });
      await expect(quantity(), "The intended BC SKU must increase by exactly one.")
        .toHaveValue(String(cartCountBefore + 1), { timeout: 60000 });
    });
    await test.step("Reload the S2 cart and validate the added SKU persists", async () => {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).toHaveURL(cartUrl);
      await expect(quantity()).toHaveValue(String(cartCountBefore + 1), { timeout: 60000 });
    });
    const cartCountAfter = cartCountBefore + 1;

    recordBusinessEvidence(testInfo, {
      source: "PreQA PLP -> PDP -> S2 cart",
      plpPath: "/mx/smartphones/all-smartphones/",
      pdpPath: PRE_QA_PDP_PATH,
      modelCode: PRE_QA_MODEL_CODE,
      cdpUrl: PRE_QA_CDP_URL,
      skuQuantityBefore: cartCountBefore,
      skuQuantityAfter: cartCountAfter,
      addToCartStatus: addResponse?.status() ?? null,
      addedFromPdp: true,
      careProtectionDeclined: true,
    });
  } finally {
    // Capture the actual CDP page before closing it, on success or failure.
    // Do not capture a WMC/login screen if the authenticated session expired.
    if (["p6-pre-qa2.samsung.com", "stg2.shop.samsung.com"].includes(new URL(page.url()).hostname)) {
      await page.screenshot({ fullPage: false }).then(body => testInfo.attach("preqa-bc-screenshot", {
        body,
        contentType: "image/png",
      })).catch(() => {});
    }
    await page.close().catch(() => {});
    await cdpBrowser.close().catch(() => {});
  }
});
