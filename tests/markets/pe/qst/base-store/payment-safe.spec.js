import { test } from "@playwright/test";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { reachPeGuestPayment } from "./peQstFlows";

const { getPeS1QstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

test("SAM-25097 @qst @pe @base-store @safe @guest - Payment using Internet Banking baseline", async ({ page }, testInfo) => {
  test.setTimeout(360000);
  test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required.");
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25097"));

  const config = getPeS1QstConfig();
  const { payment } = await reachPeGuestPayment(page, config, {
    expectedPaymentMode: /^Banca por Internet\b/i,
  });
  await payment.selectBancaPorInternet();

  testInfo.annotations.push({
    type: "qst-reuse-note",
    description:
      "Internet Banking availability and controlled payment panel are validated without payment submission. Official payment success/order criteria remain unproven until an explicitly authorized destructive run.",
  });
});
