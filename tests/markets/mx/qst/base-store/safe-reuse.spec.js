import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import {
  openMxQstPdp,
  prepareMxQstCart,
  validateMxCartProductPresentation,
  validateMxCheckoutSummaryPresentation,
  validateMxExternalServicesPresentation,
} from "./mxQstFlows";
import { reachMxGuestDelivery } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("MX QST 04 @qst @mx @base-store @safe - Navigate to PDP", async ({ page, mxConfig }) => {
  await openMxQstPdp(page, mxConfig);
  await expect(page.getByText(mxConfig.sku, { exact: true }).first()).toBeVisible();
});

test("SAM-24971 @qst @mx @base-store @safe - Cart page UI", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24971"));

  let cart;
  await test.step("Prepare the controlled MX cart", async () => {
    cart = await prepareMxQstCart(page, mxConfig);
    await cart.validateCartPage();
    await cart.validateProductInCart();
  });

  await test.step("Validate product presentation and order summary", async () => {
    await validateMxCartProductPresentation(page, mxConfig);
    const summary = await cart.validateOrderSummary();
    expect(summary.subtotal).toBeTruthy();
    expect(summary.total).toBeTruthy();
  });

  await test.step("Validate services, payment-method footer and cart footer", async () => {
    await validateMxExternalServicesPresentation(page);
    await expect(page.getByRole("heading", { name: "Tipos de pago disponibles", level: 2 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("contentinfo")).toBeVisible({ timeout: 30000 });
  });
});

test("SAM-24972 @qst @mx @base-store @safe - Increase decrease and delete cart quantity", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24972"));

  let cart;
  await test.step("Prepare and validate the controlled single-SKU cart", async () => {
    cart = await prepareMxQstCart(page, mxConfig);
    await cart.validateControlledSingleSku(mxConfig.sku);
  });

  await test.step("Increase and decrease the cart quantity", async () => {
    await cart.validateQuantityCanChange();
  });

  await test.step("Delete the product and validate the empty cart", async () => {
    await cart.clearMxCartAndConfirmEmpty();
  });
});

test("SAM-24988 @qst @mx @base-store @safe - Checkout button on cart page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24988"));

  let cart;
  await test.step("Prepare the controlled cart", async () => {
    cart = await prepareMxQstCart(page, mxConfig);
  });

  await test.step("Use the Cart Checkout button", async () => {
    await cart.proceedToCheckout();
  });

  await test.step("Validate the guest checkout entry is displayed", async () => {
    await expect(page.getByText(/Samsung Checkout Express|Continuar como (usuario )?invitado/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
  });
});

test("SAM-24989 @qst @mx @base-store @safe - Order Summary on checkout page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, {
    ...getMxQstEvidenceMetadata("SAM-24989"),
    relatedZephyrIds: ["SAM-24990", "SAM-24994", "SAM-24995"],
  });

  let checkout;
  await test.step("Reach guest Delivery with the controlled cart", async () => {
    ({ checkout } = await reachMxGuestDelivery(page, mxConfig, "mx.qst.address@example.com"));
  });

  await test.step("Validate subtotal, IVA and total in the checkout summary", async () => {
    const summary = await validateMxCheckoutSummaryPresentation(page);
    expect(summary.subtotal).toBeGreaterThan(0);
    expect(summary.iva).toBeGreaterThan(0);
    expect(summary.total).toBeGreaterThan(0);
  });

  await test.step("Fill a valid Delivery address", async () => {
    const address = await checkout.fillDelivery({
      postalCode: "01000",
      street: "Avenida Revolucion",
      exteriorNumber: "1000",
    });
    expect(address.lookupStatus).toBe(200);
    expect(address.selectedColonia).toBeTruthy();
  });

  await test.step("Continue to Payment and validate the payment page", async () => {
    await checkout.selectDeliveryAndContinue();
    await checkout.validatePaymentPage({ postalCode: "01000" });
    await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);
  });
});
