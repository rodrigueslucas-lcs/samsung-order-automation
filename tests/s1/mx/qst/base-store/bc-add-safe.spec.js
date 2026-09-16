import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

const PRE_QA_ORIGIN = "https://p6-pre-qa2.samsung.com";
const PRE_QA_PLP = `${PRE_QA_ORIGIN}/mx/smartphones/all-smartphones/`;
const PRE_QA_MODEL_CODE = "SM-S938BZBMLTM";
const PRE_QA_PDP_PATH = "/mx/smartphones/galaxy-s25-ultra/buy/";

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

test.describe.configure({ timeout: 420000 });

test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({ browser }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24969"));

  // PreQA is intentionally isolated from the normal MX S1 page fixture. The
  // storefront cart route is currently parked, but PLP/PDP and the add mutation
  // remain usable, so the cart header count is the observable assertion.
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(PRE_QA_PLP, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dismissLocationBanner(page);
    await expect(page).toHaveURL(new RegExp("p6-pre-qa2\\.samsung\\.com/mx/smartphones/all-smartphones", "i"));

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
      cartCountBefore,
      cartCountAfter,
      maintenanceObserved,
      addedFromPdp: true,
    });
  } finally {
    await context.close();
  }
});
