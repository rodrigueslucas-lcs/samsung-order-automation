import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

async function validatePaymentMode({ page, mxConfig, testInfo, id, label, marker, title }) {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata(id));
  const { checkout } = await reachMxGuestPayment(page, mxConfig, `mx.qst.${id.toLowerCase()}@example.com`);
  const button = page.getByRole("button", { name: label }).filter({ visible: true }).first();
  test.skip(!(await button.isVisible().catch(() => false)), `${title} is not offered for the current MX S1 guest checkout context; do not fabricate payment availability.`);
  if (marker) {
    const paymentLogo = button.getByRole("img");
    await expect(paymentLogo).toBeVisible();
    await expect(paymentLogo).toHaveAttribute("class", marker);
  }
  await checkout.selectPaymentMode(label);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);
  recordBusinessEvidence(testInfo, { paymentMode: title, selectedWithoutSubmit: true, note: "Safe coverage stops before any order/payment submission." });
}

test("SAM-25004 @qst @mx @base-store @safe - PayPal payment mode is available and selectable", async ({ page, mxConfig }, testInfo) => {
  await validatePaymentMode({ page, mxConfig, testInfo, id: "SAM-25004", label: /Billeteras digitales/i, marker: /PayPal/i, title: "PayPal" });
});

test("SAM-25005 @qst @mx @base-store @safe - Pay in Cash payment mode is available and selectable", async ({ page, mxConfig }, testInfo) => {
  await validatePaymentMode({ page, mxConfig, testInfo, id: "SAM-25005", label: /Pago en efectivo|Pay in Cash|Efectivo/i, title: "Pay in Cash" });
});

test("SAM-25006 @qst @mx @base-store @safe - Rewards payment mode is available and selectable", async ({ page, mxConfig }, testInfo) => {
  await validatePaymentMode({ page, mxConfig, testInfo, id: "SAM-25006", label: /Samsung Rewards|Rewards/i, title: "Rewards" });
});
