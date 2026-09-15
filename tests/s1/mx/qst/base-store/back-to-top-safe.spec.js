import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-25001 @qst @mx @base-store @safe - Back to Top returns the cart to the top", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25001"));
  // The desktop global footer (and its Back-to-Top control) is not rendered by
  // MX S1 in the compact 1280x720 runner layout used by the default project.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await prepareMxQstCart(page, mxConfig);

  const cartReminder = page.locator('[class*="ins-custom-cart-reminder-container"]:visible').last();
  if (await cartReminder.isVisible().catch(() => false)) {
    await cartReminder.getByText(/^x$/i).click();
    await expect(cartReminder).toBeHidden({ timeout: 10000 });
  }

  // MX S1 lazily appends the recommendation and global-footer sections. Keep
  // following the observable document end until the real control is hydrated.
  await page.waitForFunction(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return /Volver al inicio/i.test(document.body.innerText);
  }, null, { timeout: 60000, polling: "raf" });

  const backToTop = page.getByRole("button", { name: /^Volver al inicio$/i });
  await expect(backToTop).toBeVisible({ timeout: 30000 });

  const cartTopContent = page.getByText(/Tienes\s+1\s+producto en tu carrito/i).first();
  await expect(cartTopContent).not.toBeInViewport();
  await backToTop.click();

  await expect(cartTopContent).toBeInViewport({ timeout: 30000 });
  await expect(page).toHaveURL(/\/mx\/cart(?:[/?#]|$)/i);

  recordBusinessEvidence(testInfo, {
    backToTopVisibleAtCartFooter: true,
    returnedToTop: true,
    cartTopContentReturnedToViewport: true,
  });
});
