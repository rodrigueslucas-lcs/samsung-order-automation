import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { reachMxRegisteredDelivery } from "../../dst/base-store/mxFlows";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;
const saveAddressName = /Guardar detalles para compras futuras|Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i;

test.describe.configure({ timeout: 420000 });

async function selectAddressMode(page, name) {
  const radio = page.getByRole("radio", { name }).filter({ visible: true });
  await radio.first().waitFor({ state: "visible", timeout: 60000 });
  await radio.first().locator("xpath=ancestor::mat-radio-button[1]").click();
  await expect(radio.first()).toBeChecked({ timeout: 30000 });
}

async function openNewAddressMode(page) {
  await selectAddressMode(page, /Nueva direcci[oó]n|New address/i);
}

async function reachRegisteredDeliveryForSavedAddress(page, mxConfig) {
  // SAM-24992 only needs a clean registered checkout to validate selection of
  // an existing saved address. Use the UI-controlled cart helper here instead
  // of parsing the intercepted current-cart response body; S2 has occasionally
  // left response.json() pending until the test timeout even while the UI is
  // healthy. This keeps the business assertion unchanged and avoids weakening
  // the shared registered flow used by the already-stable scenarios below.
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateControlledSingleSku(mxConfig.sku);
  await cart.proceedToAuthenticatedCheckout();

  const checkout = new MxCheckoutPage(page);
  await checkout.fillRegisteredContact({
    firstName: "MX",
    lastName: "Automation",
    phone: "5512345678",
  });
  await checkout.validateCheckoutSummary(mxConfig.sku);
  return { checkout, cart };
}

test("SAM-24992 @qst @mx @base-store @safe @registered - Select saved address", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24992"));
  const { checkout } = await reachRegisteredDeliveryForSavedAddress(page, mxConfig);
  const savedAddress = page.getByRole("radio", { name: /Direcci[oó]n guardada|Saved address/i }).filter({ visible: true });
  const savedAddressAvailable = await savedAddress.first().waitFor({ state: "visible", timeout: 60000 }).then(() => true).catch(() => false);
  test.skip(!savedAddressAvailable, "No saved address is available in the authenticated MX S1 account; safe TC does not create persistent profile data.");
  await selectAddressMode(page, /Direcci[oó]n guardada|Saved address/i);
  const checked = page.getByRole("radio", { checked: true }).filter({ visible: true });
  await expect(checked.first()).toBeVisible({ timeout: 30000 });
  await checkout.validateCheckoutSummary(mxConfig.sku);
  recordBusinessEvidence(testInfo, { savedAddressSelected: true, persistedDataCreated: false });
});

test("SAM-24993 @qst @mx @base-store @safe @registered - Save shipping and billing address option is available", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24993"));
  const { checkout } = await reachMxRegisteredDelivery(page, mxConfig);
  await openNewAddressMode(page);
  const address = await checkout.fillDelivery({ postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" }, { registered: true });
  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();
  const saveAddress = page.getByRole("checkbox", { name: saveAddressName }).filter({ visible: true });
  await expect(saveAddress.first(), "Registered MX checkout should expose the Save-address option after a valid new address is populated.").toBeVisible({ timeout: 30000 });
  recordBusinessEvidence(testInfo, {
    saveOptionVisible: true,
    saveOptionDefaultChecked: await saveAddress.first().isChecked(),
    validAddressPopulated: true,
    profileWritePerformed: false,
  });
});

test("SAM-24994 @qst @mx @base-store @safe @registered - Checkout accepts a new unsaved address", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24994"));
  const { checkout } = await reachMxRegisteredDelivery(page, mxConfig);
  await openNewAddressMode(page);
  const address = await checkout.fillDelivery({ postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" }, { registered: true });
  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();
  const saveAddress = page.getByRole("checkbox", { name: saveAddressName }).filter({ visible: true });
  if (await saveAddress.count()) {
    const checkbox = saveAddress.first();
    if (await checkbox.isChecked()) await checkbox.uncheck({ force: true });
    await expect(checkbox, "The new checkout address must remain unsaved for this TC.").not.toBeChecked();
  }
  recordBusinessEvidence(testInfo, { newAddressAccepted: true, lookupStatus: address.lookupStatus, profileWritePerformed: false });
});

test("SAM-25000 @qst @mx @base-store @safe @registered - Switch saved and new address modes", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25000"));
  await reachMxRegisteredDelivery(page, mxConfig);
  const saved = page.getByRole("radio", { name: /Direcci[oó]n guardada|Saved address/i }).filter({ visible: true });
  const fresh = page.getByRole("radio", { name: /Nueva direcci[oó]n|New address/i }).filter({ visible: true });
  const [savedAvailable, freshAvailable] = await Promise.all([
    saved.first().waitFor({ state: "visible", timeout: 60000 }).then(() => true).catch(() => false),
    fresh.first().waitFor({ state: "visible", timeout: 60000 }).then(() => true).catch(() => false),
  ]);
  test.skip(!savedAvailable || !freshAvailable, "Both saved-address and new-address modes are required to prove switching without creating persistent data.");
  await selectAddressMode(page, /Direcci[oó]n guardada|Saved address/i);
  await expect(saved).toBeChecked();
  await selectAddressMode(page, /Nueva direcci[oó]n|New address/i);
  await expect(fresh).toBeChecked();
  await expect(saved).not.toBeChecked();
  recordBusinessEvidence(testInfo, { switchedSavedToNew: true, profileWritePerformed: false });
});
