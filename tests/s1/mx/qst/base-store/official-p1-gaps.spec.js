import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestDelivery } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-24964 @qst @mx @base-store @safe - Store GNB matches Samsung.com", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24964"));
  test.skip(true, "Official P1 is selected, but an authoritative Samsung.com GNB comparison is not implemented yet; do not report PASS from a weaker header-presence check.");
});

test("SAM-24968 @qst @mx @base-store @safe - PLP facets are displayed and filterable", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24968"));
  test.skip(true, "Official P1 is selected, but the MX S1 PLP/facet runtime flow is not implemented yet; do not fabricate facet coverage.");
});

test("SAM-24990 @qst @mx @base-store @safe - Fill mandatory customer details", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24990"));
  await reachMxGuestDelivery(page, mxConfig, "mx.qst.sam-24990@example.com");
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i);
  await expect(page.getByRole("region", { name: /2\. M[eé]todo de Entrega/i })).toBeVisible({ timeout: 30000 });
  recordBusinessEvidence(testInfo, { mandatoryCustomerDetailsAccepted: true, reachedDeliveryWithoutSubmit: true });
});

test("SAM-24995 @qst @mx @base-store @safe - Guest user cannot save address", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24995"));
  const { checkout } = await reachMxGuestDelivery(page, mxConfig, "mx.qst.sam-24995@example.com");
  const address = await checkout.fillDelivery({ postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" });
  expect(address.lookupStatus).toBe(200);
  const saveAddress = page.getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i }).filter({ visible: true });
  await expect(saveAddress).toHaveCount(0);
  recordBusinessEvidence(testInfo, { guestAddressPersistenceExposed: false, profileWritePerformed: false });
});
