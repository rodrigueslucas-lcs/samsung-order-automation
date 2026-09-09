import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import { test, expect } from "./mxQst.fixture";
import {
  openMxQstPdp,
  prepareMxQstCart,
  validateMxCartProductPresentation,
  validateMxCheckoutSummaryPresentation,
} from "./mxQstFlows";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;

test.describe.configure({ timeout: 420000 });

test("MX QST 04 @qst @mx @base-store @safe - Navigate to PDP", async ({ page, mxConfig }) => {
  await openMxQstPdp(page, mxConfig);
  await expect(page.getByText(mxConfig.sku, { exact: true }).first()).toBeVisible();
});

test("SAM-24971 @qst @mx @base-store @safe - Cart page UI", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, {
    zephyrId: "SAM-24971",
    market: "MX",
    store: "BS",
    suite: "QST",
    feature: "Cart",
    environment: "S1",
  });
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateCartPage();
  await cart.validateProductInCart();
  await validateMxCartProductPresentation(page, mxConfig);
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
  await cart.validateExternalServicesVisible();
  await cart.validateCartFooter();
});

test("SAM-24972 @qst @mx @base-store @safe - Increase decrease and delete cart quantity", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, {
    zephyrId: "SAM-24972",
    market: "MX",
    store: "BS",
    suite: "QST",
    feature: "Cart",
    environment: "S1",
  });
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateControlledSingleSku(mxConfig.sku);
  await cart.validateQuantityCanChange();
  await cart.clearMxCartAndConfirmEmpty();
});

test("SAM-24988 @qst @mx @base-store @safe - Checkout button on cart page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, {
    zephyrId: "SAM-24988",
    market: "MX",
    store: "BS",
    suite: "QST",
    feature: "Checkout",
    environment: "S1",
  });
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.proceedToCheckout();
  await expect(page.getByText(/Samsung Checkout Express|Continuar como (usuario )?invitado/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
});

test("MX QST 12 @qst @mx @base-store @safe - Enter guest address", async ({ page, mxConfig }) => {
  const { address } = await reachMxGuestPayment(page, mxConfig, "mx.qst.address@example.com");
  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();
  const summary = await validateMxCheckoutSummaryPresentation(page, mxConfig);
  expect(summary.subtotal).toBeGreaterThan(0);
  expect(summary.total).toBeGreaterThan(0);
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);
});
