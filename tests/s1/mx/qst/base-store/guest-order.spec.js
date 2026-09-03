import destructiveGuards from "../../../../../utils/destructiveGuards";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestPayment } from "../../dst/base-store/mxFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;
test.describe.configure({ retries: 0 });

test("MX QST 13 + QST 14 @destructive @qst @mx @base-store - Guest SPEI order and confirmation", async ({ page, mxConfig }) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  const inbox = `mx-qst-${Date.now()}`;
  const { checkout } = await reachMxGuestPayment(page, mxConfig, `${inbox}@mailinator.com`);
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
  console.log("MX_QST_GUEST_ORDER", JSON.stringify({ orderCode, paymentMode: "SPEI", inbox }));
});
