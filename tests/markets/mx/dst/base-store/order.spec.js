import destructiveGuards from "../../../../../utils/destructiveGuards";
import { test, expect } from "./mx.fixture";
import { reachMxGuestPayment } from "./mxFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;

test("MX TC58 @destructive @dst @mx @base-store - Guest SPEI order", async ({ page, mxConfig }) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  const inbox = `mxs1-${Date.now()}`;
  const { checkout } = await reachMxGuestPayment(
    page,
    mxConfig,
    `${inbox}@mailinator.com`
  );
  await checkout.selectPaymentMode(/^SPEI/i);

  const evidence = [];
  let responseOrderCode = null;
  page.on("response", (response) => {
    if (/order|payment|checkout|transaction/i.test(response.url())) {
      evidence.push({
        method: response.request().method(),
        status: response.status(),
        endpoint: new URL(response.url()).origin + new URL(response.url()).pathname,
      });
      response.text().then((body) => {
        responseOrderCode ||= body.match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || null;
      }).catch(() => {});
    }
  });

  const action = page.getByRole("button", { name: /^Continuar a Mercado Pago$/i });
  await action.waitFor({ state: "visible", timeout: 30000 });
  const initialUrl = page.url();
  const popupPromise = page.context().waitForEvent("page", { timeout: 120000 }).catch(() => null);
  await action.click();
  const outcome = await Promise.race([
    page.waitForURL((url) => url.href !== initialUrl, { timeout: 120000 })
      .then(() => ({ type: "redirect", target: page })),
    popupPromise.then((popup) => popup && ({ type: "popup", target: popup })),
    page.getByText(/error|problema|rechazad|no pudimos/i).first()
      .waitFor({ state: "visible", timeout: 120000 })
      .then(() => ({ type: "error", target: page })),
    page.waitForTimeout(120000).then(() => ({ type: "timeout", target: page })),
  ]);
  const target = outcome?.target || page;
  await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  const body = await target.locator("body").innerText({ timeout: 30000 }).catch(() => "");
  const orderCode = body.match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || responseOrderCode;
  console.log("MX_SPEI_SUBMIT", JSON.stringify({
    outcome: outcome?.type || "unknown",
    finalOrigin: new URL(target.url()).origin,
    orderCode,
    responses: evidence.slice(-20),
    inbox,
  }));
  expect(outcome?.type).not.toBe("timeout");
  expect(outcome?.type).not.toBe("error");
  if (!orderCode) {
    throw new Error("SPEI submit left the storefront but no MX order code was observable; do not retry blindly.");
  }
});
