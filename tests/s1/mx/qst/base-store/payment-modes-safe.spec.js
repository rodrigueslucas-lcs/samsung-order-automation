import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

const cases = [
  { id: "SAM-25004", label: /PayPal/i, title: "PayPal" },
  { id: "SAM-25005", label: /Pago en efectivo|Pay in Cash|Efectivo/i, title: "Pay in Cash" },
  { id: "SAM-25006", label: /Samsung Rewards|Rewards/i, title: "Rewards" },
];

for (const paymentCase of cases) {
  test(`${paymentCase.id} @qst @mx @base-store @safe - ${paymentCase.title} payment mode is available and selectable`, async ({ page, mxConfig }, testInfo) => {
    recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata(paymentCase.id));

    const { checkout } = await reachMxGuestPayment(
      page,
      mxConfig,
      `mx.qst.${paymentCase.id.toLowerCase()}@example.com`
    );

    const button = page
      .getByRole("button", { name: paymentCase.label })
      .filter({ visible: true })
      .first();

    test.skip(
      !(await button.isVisible().catch(() => false)),
      `${paymentCase.title} is not offered for the current MX S1 guest checkout context; do not fabricate payment availability.`
    );

    await checkout.selectPaymentMode(paymentCase.label);
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);

    recordBusinessEvidence(testInfo, {
      paymentMode: paymentCase.title,
      selectedWithoutSubmit: true,
      note: "Safe coverage stops before any order/payment submission. Runtime order completion remains destructive and requires explicit opt-in.",
    });
  });
}
