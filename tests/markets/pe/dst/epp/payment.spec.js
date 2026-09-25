import { test, expect } from "./epp.fixture";
import { reachEppPayment } from "./eppFlows";

test("TC38 TC39 TC40 TC41 @dst @epp @base-store - EPP Payment read-only structure", async ({ page, eppSmokeConfig }) => {
  test.setTimeout(360000);
  const { payment, address } = await reachEppPayment(page, eppSmokeConfig);
  await payment.validatePriceBreakdown();
  await payment.validateShippingAndBillingAddress(address);
  const modes = await payment.availablePaymentModeNames();
  expect(modes.length, "EPP Payment must expose at least one selectable mode.").toBeGreaterThan(0);
});
