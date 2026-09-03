import PaymentPage from "../../../../../pages/PaymentPage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import { test, expect } from "./mx.auth.fixture";
import { reachMxRegisteredPayment } from "./mxFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;
const REGISTERED_ORDER_SKU = "SM-F741BLBKLTM";

test.describe.configure({ retries: 0 });

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required at runtime.`);
  return value;
}

test("MX registered Amex order @destructive @dst @mx @base-store @registered", async ({ page, mxConfig }) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  expect(mxConfig.hostname).toBe("stg.shop.samsung.com");
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);

  const config = {
    ...mxConfig,
    sku: REGISTERED_ORDER_SKU,
    pdpUrl: new URL(`/mx/p/${REGISTERED_ORDER_SKU}`, mxConfig.baseUrl.origin),
  };
  const card = {
    number: requiredEnvironment("MX_TEST_CARD_NUMBER"),
    holderName: requiredEnvironment("MX_TEST_CARD_HOLDER"),
    expiry: requiredEnvironment("MX_TEST_CARD_EXPIRY"),
    cvv: requiredEnvironment("MX_TEST_CARD_CVV"),
    document: requiredEnvironment("MX_TEST_CARD_DOCUMENT"),
  };
  if (!/^\d{15}$/.test(card.number)) throw new Error("MX Amex test card must contain 15 digits.");
  if (!/^\d{2}\/\d{2}$/.test(card.expiry)) throw new Error("MX test-card expiry must use MM/YY.");
  if (!/^\d{4}$/.test(card.cvv)) throw new Error("MX Amex CVV must contain exactly 4 digits.");
  if (!/^\d{9}$/.test(card.document)) throw new Error("MX test-card document must contain 9 digits.");

  await reachMxRegisteredPayment(page, config);
  const payment = new PaymentPage(page);
  await payment.selectCreditCard();
  await payment.fillCardData(card);
  await payment.validateCreditCardReady(card);

  const result = await payment.placeOrderAndCapture();
  expect(result.orderCode).toMatch(/^MX\d{6}-\d{8}(?:_\d+)?$/i);
  console.log("MX_REGISTERED_CARD_ORDER", JSON.stringify({
    orderCode: result.orderCode,
    sku: REGISTERED_ORDER_SKU,
    paymentMode: "mx-mercadoCC",
    outcome: result.outcome,
    finalUrl: result.finalUrl,
    responses: result.responses,
  }));
});
