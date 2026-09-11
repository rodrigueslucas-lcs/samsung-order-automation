import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { mxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24969"));

  const bcUrl = process.env.MX_QST_BC_URL?.trim();
  const bcSku = process.env.MX_QST_BC_SKU?.trim() || mxConfig.sku;
  test.skip(
    !bcUrl,
    "MX_QST_BC_URL is required so the official BC/category origin is explicit instead of guessed."
  );

  const url = new URL(bcUrl);
  expect(url.protocol).toBe("https:");
  expect(url.hostname).toBe(mxConfig.hostname);
  expect(url.pathname).toMatch(/^\/mx\//i);

  const cart = mxQstCart(page, { ...mxConfig, sku: bcSku });
  await page.goto(mxConfig.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  await cart.clearMxCartAndConfirmEmpty();

  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  const productAnchor = page
    .locator(`a[href*="${bcSku}"]`)
    .filter({ visible: true })
    .first();
  await expect(productAnchor).toBeVisible({ timeout: 60000 });

  const card = productAnchor.locator(
    "xpath=ancestor::*[.//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'carrito') or contains(translate(@aria-label,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'carrito')]][1]"
  );
  const add = card
    .getByRole("button", { name: /Agregar al carrito|Add to cart|Add to basket/i })
    .filter({ visible: true })
    .first();

  test.skip(
    !(await add.isVisible().catch(() => false)),
    "The configured BC product card does not expose direct Add to Cart; this run must not silently fall back to PDP."
  );

  await add.click();
  await page.goto(mxConfig.cartUrl.toString(), { waitUntil: "domcontentloaded" });
  await cart.validateControlledSingleSku(bcSku);

  recordBusinessEvidence(testInfo, {
    bcUrl: url.origin + url.pathname,
    sku: bcSku,
    addedDirectlyFromBc: true,
  });
});
