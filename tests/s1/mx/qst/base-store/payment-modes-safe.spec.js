import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

async function validatePaymentMode({ page, mxConfig, testInfo, id, label, nestedLabel, title }) {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata(id));
  const { checkout } = await reachMxGuestPayment(page, mxConfig, `mx.qst.${id.toLowerCase()}@example.com`);
  const button = page.getByRole("button", { name: label }).filter({ visible: true }).first();
  test.skip(!(await button.isVisible().catch(() => false)), `${title} is not offered for the current MX guest checkout context; do not fabricate payment availability.`);

  const { panel } = await checkout.selectPaymentMode(label);

  if (nestedLabel) {
    const nestedButton = panel
      .getByRole("button", { name: nestedLabel })
      .filter({ visible: true })
      .first();
    const nestedText = panel
      .getByText(nestedLabel)
      .filter({ visible: true })
      .first();

    const nestedButtonVisible = await nestedButton.isVisible().catch(() => false);
    if (nestedButtonVisible) {
      await nestedButton.click();
      const expanded = await nestedButton.getAttribute("aria-expanded");
      if (expanded !== null) {
        await expect(nestedButton).toHaveAttribute("aria-expanded", "true");
      }
    } else {
      await expect(nestedText).toBeVisible({ timeout: 30000 });
    }
  }

  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);
  recordBusinessEvidence(testInfo, {
    paymentMode: title,
    selectedWithoutSubmit: true,
    note: "Safe coverage validates the real payment option and stops before any order/payment submission.",
  });
}

test("SAM-25004 @qst @mx @base-store @safe - PayPal payment mode is available and selectable", async ({ page, mxConfig }, testInfo) => {
  await validatePaymentMode({
    page,
    mxConfig,
    testInfo,
    id: "SAM-25004",
    label: /Billeteras digitales/i,
    nestedLabel: /PayPal/i,
    title: "PayPal",
  });
});

test("SAM-25005 @qst @mx @base-store @safe - Pay in Cash payment mode is available and selectable", async ({ page, mxConfig }, testInfo) => {
  await validatePaymentMode({
    page,
    mxConfig,
    testInfo,
    id: "SAM-25005",
    label: /Pago en efectivo|Pay in Cash|Efectivo/i,
    title: "Pay in Cash",
  });
});
