import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

async function expectRewardsText(page, surface) {
  const rewards = page
    .getByText(/Samsung Rewards|\bRewards\b/i)
    .filter({ visible: true });

  await expect(rewards.first(), `${surface} should display Rewards text`).toBeVisible({
    timeout: 30000,
  });

  return (await rewards.first().innerText()).replace(/\s+/g, " ").trim();
}

test("SAM-24975 @qst @mx @base-store @safe - Rewards text on cart checkout and payment", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24975"));

  const cart = await prepareMxQstCart(page, mxConfig);
  const cartRewards = await expectRewardsText(page, "Cart");

  await cart.proceedToCheckout();
  const checkout = new MxCheckoutPage(page);
  await checkout.startGuest("mx.qst.rewards@example.com");
  await checkout.fillContact({
    firstName: "MX",
    lastName: "Automation",
    phone: "5512345678",
  });

  const checkoutRewards = await expectRewardsText(page, "Checkout");

  const address = await checkout.fillDelivery({
    postalCode: "01000",
    street: "Avenida Revolucion",
    exteriorNumber: "1000",
  });
  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();

  await checkout.selectDeliveryAndContinue();
  await checkout.validatePaymentPage({ postalCode: "01000" });
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);

  const paymentRewards = await expectRewardsText(page, "Payment");

  testInfo.annotations.push({
    type: "qst-observation",
    description: `Rewards text observed on Cart (${cartRewards}), Checkout (${checkoutRewards}) and Payment (${paymentRewards}). Tooltip interaction remains a separate coverage assertion until a stable semantic control is proven live.`,
  });
});
