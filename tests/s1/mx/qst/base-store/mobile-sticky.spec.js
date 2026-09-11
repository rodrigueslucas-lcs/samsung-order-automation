import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
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
  await expect(
    page
      .getByText(/Samsung Checkout Express|Continuar como (usuario )?invitado/i)
      .filter({ visible: true })
      .first()
  ).toBeVisible({ timeout: 60000 });

  const checkoutContinue = page
    .getByRole("button", { name: /Continuar como (usuario )?invitado|Checkout como invitado/i })
    .filter({ visible: true })
    .first();
  await expect(checkoutContinue).toBeVisible({ timeout: 30000 });
  await validateStickyControl(checkoutContinue, "Checkout guest CTA");

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description:
      "Mobile assertion validates sticky/fixed checkout controls on both the Cart surface and the initial Checkout surface without submitting an order.",
  });
});
