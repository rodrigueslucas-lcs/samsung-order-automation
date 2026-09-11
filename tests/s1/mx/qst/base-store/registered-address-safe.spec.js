import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { reachMxRegisteredDelivery } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

async function openNewAddressMode(page) {
  const newAddress = page
    .getByRole("radio", { name: /Nueva direcci[oó]n|New address/i })
    .filter({ visible: true });
  if (await newAddress.count()) {
    await newAddress.first().check();
  }
}

test("SAM-24992 @qst @mx @base-store @safe @registered - Select saved address", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24992"));
  const { checkout } = await reachMxRegisteredDelivery(page, mxConfig);

  const savedAddress = page
    .getByRole("radio", { name: /Direcci[oó]n guardada|Saved address/i })
    .filter({ visible: true });
  test.skip(
    !(await savedAddress.isVisible().catch(() => false)),
    "No saved address is available in the authenticated MX S1 account; safe TC does not create persistent profile data."
  );

  await savedAddress.check();
  const checked = page.getByRole("radio", { checked: true }).filter({ visible: true });
  await expect(checked.first()).toBeVisible({ timeout: 30000 });
  await checkout.validateCheckoutSummary(mxConfig.sku);

  recordBusinessEvidence(testInfo, {
    savedAddressSelected: true,
    persistedDataCreated: false,
  });
});

test("SAM-24993 @qst @mx @base-store @safe @registered - Save option is available for registered user", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24993"));
  await reachMxRegisteredDelivery(page, mxConfig);
  await openNewAddressMode(page);

  const saveAddress = page
    .getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i })
    .filter({ visible: true });
  await expect(saveAddress.first()).toBeVisible({ timeout: 30000 });
  await expect(saveAddress.first()).not.toBeChecked();

  recordBusinessEvidence(testInfo, {
    saveOptionVisible: true,
    profileWritePerformed: false,
  });
});

test("SAM-24994 @qst @mx @base-store @safe @registered - Checkout accepts a new unsaved address", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24994"));
  const { checkout } = await reachMxRegisteredDelivery(page, mxConfig);
  await openNewAddressMode(page);

  const address = await checkout.fillDelivery(
    {
      postalCode: "01000",
      street: "Avenida Revolucion",
      exteriorNumber: "1000",
    },
    { registered: true }
  );

  expect(address.lookupStatus).toBe(200);
  expect(address.selectedColonia).toBeTruthy();

  const saveAddress = page
    .getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i })
    .filter({ visible: true });
  if (await saveAddress.count()) await expect(saveAddress.first()).not.toBeChecked();

  recordBusinessEvidence(testInfo, {
    newAddressAccepted: true,
    lookupStatus: address.lookupStatus,
    profileWritePerformed: false,
  });
});

test("SAM-25000 @qst @mx @base-store @safe @registered - Switch saved and new address modes", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25000"));
  await reachMxRegisteredDelivery(page, mxConfig);

  const saved = page
    .getByRole("radio", { name: /Direcci[oó]n guardada|Saved address/i })
    .filter({ visible: true });
  const fresh = page
    .getByRole("radio", { name: /Nueva direcci[oó]n|New address/i })
    .filter({ visible: true });

  test.skip(
    !(await saved.isVisible().catch(() => false)) || !(await fresh.isVisible().catch(() => false)),
    "Both saved-address and new-address modes are required to prove switching without creating persistent data."
  );

  await saved.check();
  await expect(saved).toBeChecked();
  await fresh.check();
  await expect(fresh).toBeChecked();
  await expect(saved).not.toBeChecked();

  recordBusinessEvidence(testInfo, {
    switchedSavedToNew: true,
    profileWritePerformed: false,
  });
});
