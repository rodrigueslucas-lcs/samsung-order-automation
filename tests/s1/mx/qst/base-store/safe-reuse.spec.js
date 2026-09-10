import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
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
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateCartPage();
  await cart.validateProductInCart();
  await validateMxCartProductPresentation(page, mxConfig);
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
  await validateMxExternalServicesPresentation(page);

  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible({ timeout: 30000 });
  await expect(footer.getByText(/Tipos de pago disponibles/i).first()).toBeVisible({ timeout: 30000 });
});

test("SAM-24972 @qst @mx @base-store @safe - Increase decrease and delete cart quantity", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24972"));
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateControlledSingleSku(mxConfig.sku);
  await cart.validateQuantityCanChange();
  await cart.clearMxCartAndConfirmEmpty();
});

test("SAM-24988 @qst @mx @base-store @safe - Checkout button on cart page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24988"));
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.proceedToCheckout();
  await expect(page.getByText(/Samsung Checkout Express|Continuar como (usuario )?invitado/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
});

test("SAM-24989 @qst @mx @base-store @safe - Order Summary on checkout page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, {
    ...getMxQstEvidenceMetadata("SAM-24989"),
    relatedZephyrIds: ["SAM-24990", "SAM-24994", "SAM-24995"],
  });

  const { checkout } = await reachMxGuestDelivery(page, mxConfig, "mx.qst.address@example.com");
  const summary = await validateMxCheckoutSummaryPresentation(page);
  expect(summary.subtotal).toBeGreaterThan(0);
  expect(summary.iva).toBeGreaterThan(0);
  expect(summary.total).toBeGreaterThan(0);

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
});
