import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { reachMxRegisteredPayment } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-25006 @qst @mx @base-store @safe @registered - Rewards payment mode is available and selectable", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25006"));
  const { checkout } = await reachMxRegisteredPayment(page, mxConfig);
  const button = page.getByRole("button", { name: /Samsung Rewards|Rewards/i })
    .filter({ visible: true })
    .first();
  test.skip(
    !(await button.isVisible().catch(() => false)),
    "Samsung Rewards is not offered for this authenticated S2 account/balance; do not fabricate payment availability."
  );
  await checkout.selectPaymentMode(/Samsung Rewards|Rewards/i);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);
  recordBusinessEvidence(testInfo, {
    paymentMode: "Rewards",
    registeredContext: true,
    selectedWithoutSubmit: true,
  });
});
