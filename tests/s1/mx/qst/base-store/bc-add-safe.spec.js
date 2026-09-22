import { chromium } from "@playwright/test";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
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
  // The global navigation is not inside the page's first <header>.
  const cartControl = page.getByRole("link", { name: /Carrito de compras/i })
    .filter({ visible: true }).first();
  if (!(await cartControl.isVisible().catch(() => false))) return null;
  const badge = cartControl.locator(".gnb-cart-count").first();
  const value = (await badge.innerText().catch(() => "")).match(/(\d+)\s*$/)?.[1];
  return value ? Number(value) : 0;
}

async function resolveObservedMinicartCountUrl(page) {
  const observed = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /\/minicart\/totalProducts(?:[?#]|$)/i.test(url));
    return resources.at(-1) || null;
  });
  if (observed) return observed;
  return new URL("/mx/minicart/totalProducts", page.url()).toString();
}

async function getAuthenticatedPreQaPage() {
  const cdpBrowser = await chromium.connectOverCDP(PRE_QA_CDP_URL);
  const contexts = cdpBrowser.contexts();
  if (!contexts.length) {
    await cdpBrowser.close();
    throw new Error(`No Chrome context found at ${PRE_QA_CDP_URL}. Keep the authenticated PreQA2 bootstrap Chrome open.`);
  }

  const context = contexts[0];

  // Always create a dedicated tab inside the already-authenticated CDP context.
  // Reusing an arbitrary existing tab can bind the TC to an S1/stage page and
  // makes the observed browser state confusing even though the context is valid.
  const page = await context.newPage();
  return { cdpBrowser, page };
}

test.describe.configure({ timeout: 420000 });

test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24969"));

  const { cdpBrowser, page } = await getAuthenticatedPreQaPage();

  try {
    await page.goto(PRE_QA_PLP, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dismissLocationBanner(page);

    if (/\/apps\/samsung\/login\//i.test(page.url())) {
      throw new Error(
        `The Chrome attached at ${PRE_QA_CDP_URL} is not authenticated for PreQA2. Keep the WMC-authenticated preqa2:bootstrap Chrome open.`
      );
    }

    await expect(page).toHaveURL(new RegExp("p6-pre-qa2\\.samsung\\.com/mx/smartphones/all-smartphones", "i"), { timeout: 30000 });

    // The product grid loads asynchronously after the PLP shell. Scroll to it
    // and wait for the result count, then target the actual product card by
    // model code; editorial/FAQ mentions of the model are not catalog cards.
    await page.getByText("Filtros", { exact: true }).first().scrollIntoViewIfNeeded();
    await expect(page.getByText(/\d+\s*Resultado/i).first()).toBeVisible({ timeout: 90000 });
    const s25Card = page.locator("[role='listitem'].pd21-product-card__item")
      .filter({ has: page.locator(`a.pd21-product-card__name[data-modelcode='${PRE_QA_MODEL_CODE}']`) })
      .first();
    await expect(s25Card, "The PreQA BC catalog must render the configured Galaxy S25 Ultra product card.")
      .toBeVisible({ timeout: 60000 });
    await s25Card.scrollIntoViewIfNeeded();
    await s25Card.getByRole("link", { name: /^Comprar:Galaxy S25 Ultra$/i }).click();

    await page.waitForURL((url) =>
      url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes(PRE_QA_PDP_PATH),
      { timeout: 60000 }
    );
    await dismissLocationBanner(page);
    await expect(page.getByText("Galaxy S25 Ultra", { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });

    const cartCountBefore = await readHeaderCartCount(page);
    expect(cartCountBefore).not.toBeNull();
    const minicartCountUrl = await resolveObservedMinicartCountUrl(page);
    const addToCart = page
      .getByRole("button", { name: /Añadir al carrito|Agregar al carrito|Add to cart|Add to bag/i })
      .filter({ visible: true })
      .first();
    await expect(addToCart).toBeVisible({ timeout: 60000 });
    const addResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/addToCart/multi/"),
    { timeout: 60000 });
    await addToCart.click();
    const addResponse = await addResponsePromise;
    expect(addResponse.ok(), "The PreQA Add to Cart request must succeed.").toBe(true);

    // The Add to Cart callback can redirect to a maintenance/system-check cart
    // before the storefront emits a second minicart request. Validate the cart
    // mutation by querying the exact minicart endpoint observed on the PDP.
    const countSnapshot = await page.request.get(minicartCountUrl);
    expect(countSnapshot.ok(), "The post-add minicart count must be readable.").toBe(true);
    const countBody = await countSnapshot.text();
    const cartCountAfter = Number(countBody.match(/<Integer>(\d+)<\/Integer>/i)?.[1]);
    expect(Number.isFinite(cartCountAfter), "The minicart must return a numeric product count.").toBe(true);
    expect(cartCountAfter).toBeGreaterThan(cartCountBefore);
    recordBusinessEvidence(testInfo, {
      source: "PreQA PLP -> PDP",
      plpPath: "/mx/smartphones/all-smartphones/",
      pdpPath: PRE_QA_PDP_PATH,
      modelCode: PRE_QA_MODEL_CODE,
      cdpUrl: PRE_QA_CDP_URL,
      cartCountBefore,
      cartCountAfter,
      addToCartStatus: addResponse.status(),
      addedFromPdp: true,
    });
  } finally {
    await page.close().catch(() => {});
    await cdpBrowser.close().catch(() => {});
  }
});
