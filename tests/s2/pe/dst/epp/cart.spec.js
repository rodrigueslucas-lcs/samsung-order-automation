import { test, expect } from "./epp.fixture";
import { prepareEppCart } from "./eppFlows";

test("TC11 TC12 TC14 TC16 TC17 @dst @epp @base-store - EPP cart read-only structure", async ({ page, eppSmokeConfig }) => {
  test.setTimeout(240000);
  const { cart } = await prepareEppCart(page, eppSmokeConfig);
  await cart.validateCartPage();
  await cart.validateProductInCart();
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
  await cart.validateCheckoutButton();
  await cart.validateCartFooter();
});

test("TC18 @dst @epp @base-store - EPP cart navigates to authenticated Checkout", async ({ page, eppSmokeConfig }) => {
  test.setTimeout(240000);
  const { cart } = await prepareEppCart(page, eppSmokeConfig);
  await cart.proceedToAuthenticatedCheckout();
  expect(new URL(page.url()).hostname).toBe(eppSmokeConfig.hostname);
});

test("TC13 @dst @epp @base-store - EPP cart quantity changes safely", async ({ page, eppSmokeConfig }) => {
  const { cart } = await prepareEppCart(page, eppSmokeConfig);
  await cart.validateQuantityCanChange();
});
