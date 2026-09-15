import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-25001 @qst @mx @base-store @safe - Back to Top returns the cart to the top", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25001"));
  await prepareMxQstCart(page, mxConfig);

  // The cart footer is hydrated only after it enters the viewport in MX S1.
  // The Back-to-Top control is not consistently exposed with button semantics.
  const paymentTypes = page.getByRole("heading", { name: /^Tipos de pago disponibles$/i });
  await paymentTypes.scrollIntoViewIfNeeded();

  const backToTop = page.getByText(/^Volver al inicio$/i, { exact: true }).last();
  await expect(backToTop).toBeVisible({ timeout: 30000 });

  const cartReminder = page.locator('[class*="ins-custom-cart-reminder-container"]:visible').last();
  if (await cartReminder.isVisible().catch(() => false)) {
    await cartReminder.getByText(/^x$/i).click();
    await expect(cartReminder).toBeHidden({ timeout: 10000 });
  }

  const cartHeading = page.getByRole("heading", { name: /^Cart$/, level: 1 });
  await expect(cartHeading).not.toBeInViewport();
  await backToTop.click();

  await expect(cartHeading).toBeInViewport({ timeout: 30000 });
  await expect(page).toHaveURL(/\/mx\/cart(?:[/?#]|$)/i);

  recordBusinessEvidence(testInfo, {
    backToTopVisibleAtCartFooter: true,
    returnedToTop: true,
    cartHeadingReturnedToViewport: true,
  });
});
