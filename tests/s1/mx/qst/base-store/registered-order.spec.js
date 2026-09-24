import MarketPaymentPage from "../../../../../pages/MarketPaymentPage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import mxTestCard from "../../../../../utils/mxTestCard.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { reachMxRegisteredPayment } from "../../dst/base-store/mxFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const { getMxTestCard } = mxTestCard;
test.describe.configure({ retries: 0 });

test.skip(process.env.ALLOW_PAYMENT_SUBMIT !== "1", "Registered order submit is destructive and requires ALLOW_PAYMENT_SUBMIT=1.");

test("SAM-25002 @destructive @qst @mx @base-store @registered - Complete card payment with registered user", async ({ page, mxConfig }, testInfo) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25002"));
  const sku = "SM-F741BLBKLTM";
  const config = { ...mxConfig, sku, pdpUrl: new URL(`/mx/p/${sku}`, mxConfig.baseUrl.origin) };

  await test.step("Reach registered-user payment step with the controlled SKU", async () => {
    await reachMxRegisteredPayment(page, config);
  });

  const payment = new MarketPaymentPage(page, { market: "MX" });
  const card = getMxTestCard();

  await test.step("Select Mercado Pago credit card", async () => {
    await payment.selectCreditCard();
  });

  await test.step("Fill and validate the configured test-card data", async () => {
    await payment.fillCardData(card);
    await payment.validateCreditCardReady(card);
  });

  const result = await test.step("Submit the payment and capture the Samsung order", async () =>
    payment.placeOrderAndCapture()
  );

  await test.step("Validate the generated MX order code", async () => {
    expect(result.orderCode).toMatch(/^MX\d{6}-\d{8}(?:_\d+)?$/i);
  });

  console.log("MX_QST_REGISTERED_ORDER", JSON.stringify({ orderCode: result.orderCode, paymentMode: "mx-mercadoCC", outcome: result.outcome }));
});
