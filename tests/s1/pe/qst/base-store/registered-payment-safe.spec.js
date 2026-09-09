import { test } from "@playwright/test";
import peAuthStateModule from "../../../../../utils/peAuthState";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { reachPeRegisteredPayment } from "./peQstFlows";

const {
  PE_AUTH_STATE_PATH,
  getPeAuthState,
  hasPeAuthState,
} = peAuthStateModule;
const { getPeS1QstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

test.describe("PE S1 QST - registered payment safe checkpoints", () => {
  test.use({ storageState: hasPeAuthState() ? PE_AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required.");
    test.skip(!hasPeAuthState(), "Authenticated PE S1 state is required.");
    const auth = getPeAuthState();
    await auth.applyAuthSessionStorage(context);
  });

  test("SAM-25095 @qst @pe @base-store @safe @registered - Payment using credit/debit card baseline", async ({ page }, testInfo) => {
    test.setTimeout(360000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25095"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    const { payment } = await reachPeRegisteredPayment(page, config, {
      expectedPaymentMode: /Tarjeta de Crédito \/ Débito/i,
    });
    await payment.selectCreditCard();

    testInfo.annotations.push({
      type: "qst-reuse-note",
      description:
        "Registered-user card mode and card form entry are validated without card submission or order placement. Official successful-payment criteria remain pending destructive proof.",
    });
  });

  test("SAM-25096 @qst @pe @base-store @safe @registered - Payment using Cash Payment baseline", async ({ page }, testInfo) => {
    test.setTimeout(360000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25096"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    const { payment } = await reachPeRegisteredPayment(page, config, {
      expectedPaymentMode: /^Pago Efectivo\b/i,
    });
    await payment.selectPagoEfectivo();

    testInfo.annotations.push({
      type: "qst-reuse-note",
      description:
        "Registered-user Pago Efectivo availability and controlled payment panel are validated without payment submission. Official successful-payment criteria remain pending destructive proof.",
    });
  });
});
