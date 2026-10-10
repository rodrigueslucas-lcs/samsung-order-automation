import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestDelivery } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-24999 @qst @mx @base-store @safe - Invalid address is rejected", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24999"));

  await test.step("Reach guest Delivery with valid customer information", async () => {
    await reachMxGuestDelivery(
      page,
      mxConfig,
      "mx.qst.invalid.address@example.com"
    );
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i);
  });

  const postal = page.getByRole("textbox", { name: /postal|c[oó]digo postal/i });
  const invalidPostalCode = "00000";
  let response;

  await test.step("Submit an invalid MX postal code", async () => {
    await expect(postal).toBeVisible({ timeout: 60000 });
    const responsePromise = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("getAddressForWardPostCode") &&
        candidate.url().includes(`postCode=${invalidPostalCode}`),
      { timeout: 60000 }
    );

    await postal.fill(invalidPostalCode);
    await postal.press("Tab");
    response = await responsePromise;
  });

  const colonia = page.getByRole("combobox", { name: /Colonia/i });
  const continueButton = page
    .getByRole("button", { name: /^Continuar$/i })
    .filter({ visible: true });
  const visibleValidation = page
    .getByText(/c[oó]digo postal.*(inv[aá]lido|no v[aá]lido|no encontrado)|direcci[oó]n.*(inv[aá]lida|no v[aá]lida)/i)
    .filter({ visible: true });

  const readRejection = async () => ({
    httpRejected: !response.ok(),
    validationVisible: (await visibleValidation.count()) > 0,
    coloniaUnavailable:
      (await colonia.count()) === 0 ||
      !(await colonia.first().isEnabled().catch(() => false)),
    continueDisabled:
      (await continueButton.count()) === 0 ||
      !(await continueButton.first().isEnabled().catch(() => false)),
  });

  let rejection;
  await test.step("Validate the invalid address is blocked on Delivery", async () => {
    await expect
      .poll(async () => Object.values(await readRejection()).some(Boolean), {
        timeout: 30000,
        message: "Invalid postal code should produce an observable validation barrier.",
      })
      .toBeTruthy();

    rejection = await readRejection();
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i);
  });

  recordBusinessEvidence(testInfo, {
    invalidPostalCode,
    lookupStatus: response.status(),
    rejection,
  });
});
