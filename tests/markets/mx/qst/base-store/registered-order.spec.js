import MarketPaymentPage from "../../../../../pages/MarketPaymentPage";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import mxTestCard from "../../../../../utils/mxTestCard.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { requirePaymentSubmitOptIn } = destructiveGuards;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const { getMxTestCard } = mxTestCard;
test.describe.configure({ retries: 0 });

test.skip(process.env.ALLOW_PAYMENT_SUBMIT !== "1", "Registered order submit is destructive and requires ALLOW_PAYMENT_SUBMIT=1.");

async function reachRegisteredPaymentViaUi(page, config) {
  // Keep this destructive order flow independent from current-cart response bodies.
  // prepareMxQstCart already proves one rendered SKU at quantity 1 via the UI,
  // so do not call CartPage.validateControlledSingleSku() here because that
  // reintroduces the hanging /users/current/carts/current response-body dependency.
  const cart = await prepareMxQstCart(page, config);
  await cart.proceedToAuthenticatedCheckout();

  const checkout = new MxCheckoutPage(page);
  await checkout.fillRegisteredContact({
    firstName: "MX",
    lastName: "Automation",
    phone: "5512345678",
  });
  await checkout.validateCheckoutSummary(config.sku);

  const newAddress = page
    .getByRole("radio", { name: /Nueva direcci[oó]n|New address/i })
    .filter({ visible: true })
    .first();
  const newAddressAvailable = await newAddress
    .waitFor({ state: "visible", timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (newAddressAvailable) {
    await newAddress.check({ force: true });
    await expect(newAddress).toBeChecked({ timeout: 30000 });
  }

  await checkout.fillDelivery(
    { postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" },
    { registered: true }
  );
  await checkout.selectDeliveryAndContinue();
  await checkout.validatePaymentPage({ postalCode: "01000" });
}

test("SAM-25002 @destructive @qst @mx @base-store @registered - Complete card payment with registered user", async ({ page, mxConfig }, testInfo) => {
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25002"));
  const sku = "SM-F741BLBKLTM";
  const config = { ...mxConfig, sku, pdpUrl: new URL(`/mx/p/${sku}`, mxConfig.baseUrl.origin) };

  await test.step("Reach registered-user payment step with the controlled SKU", async () => {
    await reachRegisteredPaymentViaUi(page, config);
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
