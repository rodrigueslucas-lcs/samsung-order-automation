import { chromium } from "@playwright/test";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

const PRE_QA_ORIGIN = "https://p6-pre-qa2.samsung.com";
const PRE_QA_PLP = `${PRE_QA_ORIGIN}/mx/smartphones/all-smartphones/`;
const PRE_QA_MODEL_CODE = "SM-S938BZBMLTM";
const PRE_QA_PDP_PATH = "/mx/smartphones/galaxy-s25-ultra/buy/";
const PRE_QA_CDP_URL = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";

async function dismissLocationBanner(page) {
  const continueButton = page.getByRole("button", { name: /Continuar/i }).filter({ visible: true });
  if (await continueButton.count()) {
    await continueButton.first().click().catch(() => {});
  }
}

async function readHeaderCartCount(page) {
  const cartControl = page.getByRole("link", { name: /Carrito de compras/i })
    .filter({ visible: true }).first();
  if (!(await cartControl.isVisible().catch(() => false))) return null;
  const badge = cartControl.locator(".gnb-cart-count").first();
  const value = (await badge.innerText().catch(() => "")).match(/(\d+)\s*$/)?.[1];
  return value ? Number(value) : 0;
}

async function resolveObservedMinicartCountUrl(page) {
  await page.waitForFunction(() => {
    return performance.getEntriesByType("resource")
      .some((entry) => /\/minicart\/totalProducts(?:[?#]|$)/i.test(entry.name));
  }, null, { timeout: 30000 });
  return page.evaluate(() => {
    const resources = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /\/minicart\/totalProducts(?:[?#]|$)/i.test(url));
    return resources.at(-1);
  });
}

async function readMinicartCount(page, url) {
  const response = await page.request.get(url);
  expect(response.ok(), "The PreQA PDP minicart count must be readable.").toBe(true);
  const body = await response.text();
  const count = Number(body.match(/<Integer>(\d+)<\/Integer>/i)?.[1]);
  expect(Number.isFinite(count), "The minicart must return a numeric product count.").toBe(true);
  return count;
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
  return { cdpBrowser, page };
}

async function returnToPreQaPdp(page) {
  const expected = new RegExp("p6-pre-qa2\\.samsung\\.com/mx/smartphones/galaxy-s25-ultra/buy", "i");
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

test.describe.configure({ timeout: 420000 });

test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24969"));

  const { cdpBrowser, page } = await getAuthenticatedPreQaPage();

  try {
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

    await test.step("Open the configured Galaxy S25 Ultra PDP from the BC catalog", async () => {
      await page.getByText("Filtros", { exact: true }).first().scrollIntoViewIfNeeded();
      await expect(page.getByText(/\d+\s*Resultado/i).first()).toBeVisible({ timeout: 90000 });
      const s25Card = page.locator("[role='listitem'].pd21-product-card__item")
        .filter({ has: page.locator(`a.pd21-product-card__name[data-modelcode='${PRE_QA_MODEL_CODE}']`) })
        .first();
      await s25Card.evaluate((card) => card.scrollIntoView({ block: "center" }));
      await expect(s25Card, "The PreQA BC catalog must render the configured Galaxy S25 Ultra product card.")
        .toBeVisible({ timeout: 60000 });
      await s25Card.getByRole("link", { name: /^Comprar:Galaxy S25 Ultra$/i }).click();

      await page.waitForURL((url) =>
        url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes(PRE_QA_PDP_PATH),
        { timeout: 60000 }
      );
      await dismissLocationBanner(page);
      await expect(page.getByText("Galaxy S25 Ultra", { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
    });

    const cartCountBefore = await readHeaderCartCount(page);
    expect(cartCountBefore).not.toBeNull();
    const minicartCountUrl = await resolveObservedMinicartCountUrl(page);
    const apiCountBefore = await readMinicartCount(page, minicartCountUrl);
    let addResponse;

    await test.step("Add the product and validate the minicart API mutation", async () => {
      const addToCart = page
        .getByRole("button", { name: /Añadir al carrito|Agregar al carrito|Add to cart|Add to bag/i })
        .filter({ visible: true })
        .first();
      await expect(addToCart).toBeVisible({ timeout: 60000 });
      const addResponsePromise = page.waitForResponse((response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/addToCart/multi/"),
      { timeout: 15000 }).catch(() => null);
      await addToCart.click();
      addResponse = await addResponsePromise;
      if (addResponse) {
        expect(addResponse.ok(), "The PreQA Add to Cart request must succeed.").toBe(true);
      }

      await expect.poll(() => readMinicartCount(page, minicartCountUrl), {
        timeout: 30000,
        message: "The PreQA Add to Cart action must increase the observed minicart count.",
      }).toBeGreaterThan(apiCountBefore);
    });

    const cartCountAfter = await readMinicartCount(page, minicartCountUrl);

    await test.step("Return to the PDP and validate the header minicart badge", async () => {
      await returnToPreQaPdp(page);
      const badgeUpdated = await expect.poll(() => readHeaderCartCount(page), {
        timeout: 10000,
        message: "The PDP minicart badge should refresh after Add to Cart.",
      }).toBeGreaterThan(cartCountBefore).then(() => true, () => false);
      if (!badgeUpdated) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await dismissLocationBanner(page);
      }
      await expect.poll(() => readHeaderCartCount(page), {
        timeout: 30000,
        message: "The PreQA PDP header minicart must show the added product after returning from maintenance.",
      }).toBeGreaterThan(cartCountBefore);
    });

    recordBusinessEvidence(testInfo, {
      source: "PreQA PLP -> PDP",
      plpPath: "/mx/smartphones/all-smartphones/",
      pdpPath: PRE_QA_PDP_PATH,
      modelCode: PRE_QA_MODEL_CODE,
      cdpUrl: PRE_QA_CDP_URL,
      cartCountBefore,
      cartCountAfter,
      addToCartStatus: addResponse?.status() ?? null,
      addedFromPdp: true,
    });
  } finally {
    await page.close().catch(() => {});
    await cdpBrowser.close().catch(() => {});
  }
});
