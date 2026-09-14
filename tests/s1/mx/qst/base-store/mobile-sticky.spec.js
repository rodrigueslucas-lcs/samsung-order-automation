import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart, validateStickyControl } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

const mobileViewport = { width: 390, height: 844 };

test.use({ viewport: mobileViewport });
test.describe.configure({ timeout: 420000 });

test("SAM-25016 @qst @mx @base-store @safe @mobile - Mobile Sticky checkout", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25016"));

  const cart = await prepareMxQstCart(page, mxConfig);
  const cartCheckout = page
    .getByRole("button", { name: /Finalizar Compra/i })
    .filter({ visible: true })
    .first();
  await validateStickyControl(cartCheckout, "Cart checkout button");

  await cart.proceedToCheckout();
  const checkout = new MxCheckoutPage(page);
  await checkout.startGuest("mx.qst.mobile.sticky@example.com");

  await page.getByRole("textbox", { name: "firstName" }).fill("MX");
  await page.getByRole("textbox", { name: "lastName" }).fill("Automation");
  await page.getByRole("textbox", { name: "phone", exact: true }).fill("5512345678");

  const requiredCheckboxes = page.locator('input[type="checkbox"]:visible');
  for (let index = 0; index < await requiredCheckboxes.count(); index += 1) {
    const checkbox = requiredCheckboxes.nth(index);
    if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
  }

  await expect(checkout.contactContinue).toBeVisible({ timeout: 30000 });
  await expect(checkout.contactContinue).toBeEnabled({ timeout: 30000 });
  await validateStickyControl(checkout.contactContinue, "Checkout contact Continue button");

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description:
      "Mobile assertion validates the sticky/fixed Cart checkout CTA and the real Checkout Contact-step Continue CTA. The initial guest-login CTA is intentionally not treated as the checkout sticky control because live S1 proved it is not sticky/fixed.",
  });
});
