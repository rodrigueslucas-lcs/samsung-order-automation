import PaymentPage from "../../../../../pages/PaymentPage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { reachMxRegisteredPayment } from "../../dst/base-store/mxFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;
test.describe.configure({ retries: 0 });

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required at runtime.`);
  return value;
}

test("MX QST 16 @destructive @qst @mx @base-store @registered - Registered Amex order", async ({ page, mxConfig }) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  const sku = "SM-F741BLBKLTM";
  const config = { ...mxConfig, sku, pdpUrl: new URL(`/mx/p/${sku}`, mxConfig.baseUrl.origin) };
  await reachMxRegisteredPayment(page, config);
  const payment = new PaymentPage(page);
  const card = {
    number: required("MX_TEST_CARD_NUMBER"),
    holderName: required("MX_TEST_CARD_HOLDER"),
    expiry: required("MX_TEST_CARD_EXPIRY"),
    cvv: required("MX_TEST_CARD_CVV"),
    document: required("MX_TEST_CARD_DOCUMENT"),
  };
  await payment.selectCreditCard();
  await payment.fillCardData(card);
  await payment.validateCreditCardReady(card);
  const result = await payment.placeOrderAndCapture();
  expect(result.orderCode).toMatch(/^MX\d{6}-\d{8}(?:_\d+)?$/i);
  console.log("MX_QST_REGISTERED_ORDER", JSON.stringify({
    orderCode: result.orderCode,
    paymentMode: "mx-mercadoCC",
    outcome: result.outcome,
  }));
});
