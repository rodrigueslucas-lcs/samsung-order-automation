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
  const header = page.locator("header").first();
  const cartControl = header
    .getByRole("link", { name: /carrito|cart/i })
    .or(header.getByRole("button", { name: /carrito|cart/i }))
    .first();

  if (await cartControl.count()) {
    const text = await cartControl.innerText().catch(() => "");
    const aria = await cartControl.getAttribute("aria-label").catch(() => "");
    const match = `${text} ${aria}`.match(/\b(\d+)\b/);
    if (match) return Number(match[1]);
  }

  const badge = header
    .locator("[class*='cart'] [class*='badge'], [class*='cart'] [class*='count'], [class*='Cart'] [class*='badge'], [class*='Cart'] [class*='count']")
    .filter({ visible: true });
  for (let index = 0; index < await badge.count(); index += 1) {
    const value = (await badge.nth(index).innerText().catch(() => "")).trim();
    if (/^\d+$/.test(value)) return Number(value);
  }

  return 0;
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

    const s25Card = page.getByText("Galaxy S25 Ultra", { exact: true }).filter({ visible: true }).first().locator(
      "xpath=ancestor::*[.//button[normalize-space()='Comprar']][1]"
    );
    await expect(s25Card).toBeVisible({ timeout: 60000 });
    await s25Card.getByRole("button", { name: /^Comprar$/i }).click();

    await page.waitForURL((url) =>
      url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes(PRE_QA_PDP_PATH),
      { timeout: 60000 }
    );
    await dismissLocationBanner(page);
    await expect(page.getByText("Galaxy S25 Ultra", { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });

    const cartCountBefore = await readHeaderCartCount(page);
    const addToCart = page
      .getByRole("button", { name: /Añadir al carrito|Agregar al carrito|Add to cart|Add to bag/i })
      .filter({ visible: true })
      .first();
    await expect(addToCart).toBeVisible({ timeout: 60000 });
    await addToCart.click();

    await page.waitForURL((url) =>
      /SystemParking\.html/i.test(url.pathname) || url.hostname === "p6-pre-qa2.samsung.com",
      { timeout: 60000 }
    ).catch(() => {});

    const maintenanceObserved = /SystemParking\.html/i.test(new URL(page.url()).pathname);
    if (maintenanceObserved) {
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForURL((url) =>
        url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes(PRE_QA_PDP_PATH),
        { timeout: 60000 }
      );
      await dismissLocationBanner(page);
    }

    await expect.poll(() => readHeaderCartCount(page), {
      timeout: 60000,
      message: "PreQA Add to Cart should increase the header cart count even when /cart is parked for maintenance.",
    }).toBeGreaterThan(cartCountBefore);

    const cartCountAfter = await readHeaderCartCount(page);
    recordBusinessEvidence(testInfo, {
      source: "PreQA PLP -> PDP",
      plpPath: "/mx/smartphones/all-smartphones/",
      pdpPath: PRE_QA_PDP_PATH,
      modelCode: PRE_QA_MODEL_CODE,
      cdpUrl: PRE_QA_CDP_URL,
      cartCountBefore,
      cartCountAfter,
      maintenanceObserved,
      addedFromPdp: true,
    });
  } finally {
    await page.close().catch(() => {});
    await cdpBrowser.close().catch(() => {});
  }
});
