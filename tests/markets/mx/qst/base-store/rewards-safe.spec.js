import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
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

async function validatePaymentPageWithRecovery(checkout, page, postalCode, testInfo) {
  try {
    await checkout.validatePaymentPage({ postalCode });
    return false;
  } catch (firstError) {
    if (!/CHECKOUT_STEP_PAYMENT/i.test(page.url())) throw firstError;

    testInfo.annotations.push({
      type: "qst-recovery",
      description:
        "Payment URL was reached but the dynamic Payment UI did not finish rendering. Performed one controlled reload before failing the business scenario.",
    });

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i, { timeout: 30000 });

    try {
      await checkout.validatePaymentPage({ postalCode });
    } catch (retryError) {
      throw new Error(
        `MX Payment remained incomplete after one controlled reload. ` +
        `Initial render error: ${firstError.message}. Retry error: ${retryError.message}`
      );
    }

    return true;
  }
}

test("SAM-24975 @qst @mx @base-store @safe - Rewards text on cart checkout and payment", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24975"));

  let cart;
  let cartRewards;
  let checkout;
  let checkoutRewards;
  let paymentRewards;

  await test.step("Prepare the controlled cart and validate Rewards on Cart", async () => {
    cart = await prepareMxQstCart(page, mxConfig);
    cartRewards = await expectRewardsText(page, "Cart");
  });

  await test.step("Start guest checkout and validate Rewards on Contact Information", async () => {
    await cart.proceedToCheckout();
    checkout = new MxCheckoutPage(page);
    await checkout.startGuest("mx.qst.rewards@example.com");
    await checkout.fillContact({
      firstName: "MX",
      lastName: "Automation",
      phone: "5512345678",
    });
    checkoutRewards = await expectRewardsText(page, "Checkout");
  });

  await test.step("Fill and validate the MX delivery address", async () => {
    const address = await checkout.fillDelivery({
      postalCode: "01000",
      street: "Avenida Revolucion",
      exteriorNumber: "1000",
    });
    expect(address.lookupStatus).toBe(200);
    expect(address.selectedColonia).toBeTruthy();
  });

  await test.step("Continue from Delivery and wait for a stable Payment render", async () => {
    await checkout.selectDeliveryAndContinue();
    await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i, { timeout: 120000 });
    await validatePaymentPageWithRecovery(checkout, page, "01000", testInfo);
  });

  await test.step("Validate Rewards on the Payment page", async () => {
    paymentRewards = await expectRewardsText(page, "Payment");
  });

  testInfo.annotations.push({
    type: "qst-observation",
    description: `Rewards text observed on Cart (${cartRewards}), Checkout (${checkoutRewards}) and Payment (${paymentRewards}). Tooltip interaction remains a separate coverage assertion until a stable semantic control is proven live.`,
  });
});
