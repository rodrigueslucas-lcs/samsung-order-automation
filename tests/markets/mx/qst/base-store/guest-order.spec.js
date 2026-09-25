import fs from "node:fs";
import path from "node:path";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;
const guestOrderRuntimeFile = path.resolve("test-results/mx-qst/latest-guest-order.json");
test.describe.configure({ retries: 0 });

test.skip(
  process.env.ALLOW_PAYMENT_SUBMIT !== "1",
  "Guest order submit is destructive and requires ALLOW_PAYMENT_SUBMIT=1."
);

test("MX QST 13 + QST 14 @destructive @qst @mx @base-store - Guest SPEI order and confirmation", async ({ page, mxConfig }) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  const inbox = `mx-qst-${Date.now()}`;
  const email = `${inbox}@mailinator.com`;
  const { checkout } = await reachMxGuestPayment(page, mxConfig, email);
  await checkout.selectPaymentMode(/^SPEI/i);

  let responseOrderCode = null;
  page.on("response", (response) => {
    if (!/order|payment|checkout|transaction/i.test(response.url())) return;
    response.text().then((body) => {
      responseOrderCode ||= body.match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || null;
    }).catch(() => {});
  });

  const action = page.getByRole("button", { name: /^Continuar a Mercado Pago$/i });
  await expect(action).toBeEnabled({ timeout: 30000 });
  const initialUrl = page.url();
  const popupPromise = page.context().waitForEvent("page", { timeout: 120000 }).catch(() => null);
  await action.click();
  const outcome = await Promise.race([
    page.waitForURL((url) => url.href !== initialUrl, { timeout: 120000 }).then(() => page),
    popupPromise,
  ]);
  const target = outcome || page;
  await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  const body = await target.locator("body").innerText({ timeout: 30000 }).catch(() => "");
  const orderCode = body.match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || responseOrderCode;
  if (!orderCode) {
    throw new Error("MX QST Guest SPEI submit produced no observable order code; do not retry.");
  }
  await expect(target.getByText(/confirmaci[oó]n|pedido recibido|gracias por tu compra/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });

  fs.mkdirSync(path.dirname(guestOrderRuntimeFile), { recursive: true });
  fs.writeFileSync(guestOrderRuntimeFile, JSON.stringify({
    orderNumber: orderCode,
    email,
    inbox,
    market: "mx",
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log("MX_QST_GUEST_ORDER", JSON.stringify({ orderCode, paymentMode: "SPEI", inbox }));
  console.log(`[mx-qst] Guest tracking runtime saved to ${guestOrderRuntimeFile}`);
});
