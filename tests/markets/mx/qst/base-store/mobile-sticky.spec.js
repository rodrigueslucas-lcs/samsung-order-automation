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

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description:
      "Validates the official Checkout button: the mobile Cart CTA labelled Finalizar Compra. Contact-step Continue is step navigation, not the Checkout button named by the TC.",
  });
});
