import { test, expect } from "./mxQst.fixture";
import { openMxQstPdp, prepareMxQstCart } from "./mxQstFlows";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

test.describe.configure({ timeout: 420000 });

test("MX QST 04 @qst @mx @base-store @safe - Navigate to PDP", async ({ page, mxConfig }) => {
  await openMxQstPdp(page, mxConfig);
  await expect(page.getByText(mxConfig.sku, { exact: true }).first()).toBeVisible();
});

test("MX QST 06 + QST 07 + QST 08 @qst @mx @base-store @safe - Add product and validate Cart", async ({ page, mxConfig }) => {
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateCartPage();
  await cart.validateProductInCart();
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
});

test("MX QST 11 @qst @mx @base-store @safe - Navigate to Checkout", async ({ page, mxConfig }) => {
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.proceedToCheckout();
  await expect(page.getByText(/Samsung Checkout Express|Continuar como (usuario )?invitado/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
});

test("MX QST 12 @qst @mx @base-store @safe - Enter guest address", async ({ page, mxConfig }) => {
  const { address } = await reachMxGuestPayment(page, mxConfig, "mx.qst.address@example.com");
  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i);
});
