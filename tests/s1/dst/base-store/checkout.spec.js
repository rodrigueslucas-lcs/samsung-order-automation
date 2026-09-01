import { test, expect } from "./mx.fixture";
import { reachMxGuestPayment } from "./mxFlows";

test("MX TC35 TC37 TC38 TC42-TC57 @dst @mx @base-store - Guest checkout reaches Payment", async ({ page, mxConfig }, testInfo) => {
  test.setTimeout(420000);
  const paymentModeResponses = [];
  page.on("response", (response) => {
    if (/payment.?modes?/i.test(response.url())) paymentModeResponses.push(response);
  });
  const { checkout, address } = await reachMxGuestPayment(
    page,
    mxConfig,
    "mx.s1.qa.automation@example.com"
  );
  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();
  const modes = await checkout.inspectPayment();
  expect(modes.length).toBeGreaterThan(0);
  testInfo.annotations.push({
    type: "payment-modes",
    description: modes.map((mode) => mode.label).join(" | "),
  });
  console.log("MX_PAYMENT_MODES", JSON.stringify(modes));
  const responseEvidence = [];
  for (const response of paymentModeResponses) {
    const body = await response.json().catch(() => null);
    const candidates = Array.isArray(body)
      ? body
      : body?.paymentModes || body?.payments || body?.data || [];
    responseEvidence.push({
      endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
      status: response.status(),
      modes: Array.isArray(candidates)
        ? candidates.map((item) => ({
            code: item.code || item.id || item.paymentMode || null,
            name: item.name || item.displayName || item.label || null,
          }))
        : [],
    });
  }
  console.log("MX_PAYMENT_MODE_API", JSON.stringify(responseEvidence));
  await checkout.selectPaymentMode(/^SPEI/i);
  await expect(page.getByRole("button", { name: /^Continuar a Mercado Pago$/i })).toBeVisible({
    timeout: 30000,
  });
});
