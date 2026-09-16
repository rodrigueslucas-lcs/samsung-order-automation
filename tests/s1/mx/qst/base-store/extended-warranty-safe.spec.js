import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart, openMxService } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

function parseMxCurrency(text) {
  const match = String(text || "").match(/\$\s*([\d,.]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

test.describe.configure({ timeout: 420000 });

test("SAM-24985 @qst @mx @base-store @safe - Extended Warranty on Cart", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24985"));
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateControlledSingleSku(mxConfig.sku);

  const totalHeading = page.getByRole("heading", { name: /Total con IVA/i });
  await expect(totalHeading).toBeVisible({ timeout: 30000 });
  const totalBefore = parseMxCurrency(await totalHeading.locator("..").innerText());
  expect(totalBefore).not.toBeNull();

  const careSurface = await openMxService(page, "Samsung Care\\+");
  const extendedWarrantyPlan = careSurface
    .getByText(/Garant[ií]a extendida/i)
    .filter({ visible: true })
    .first();
  await expect(extendedWarrantyPlan).toBeVisible({ timeout: 30000 });

  const planCard = extendedWarrantyPlan.locator(
    "xpath=ancestor::*[.//input[@type='radio'] or .//*[@role='radio']][1]"
  );
  await expect(planCard).toBeVisible({ timeout: 30000 });

  const planInput = planCard.locator("input[type='radio']").first();
  await expect(planInput).toBeAttached({ timeout: 30000 });
  await planInput.check({ force: true });
  await expect(planInput).toBeChecked({ timeout: 10000 });

  const termsSection = careSurface.getByText(/T[eé]rminos y condiciones de Samsung Care\+/i).first();
  await expect(termsSection).toBeVisible({ timeout: 30000 });

  // After the plan is selected the modal exposes exactly four consent radio
  // controls below the terms heading. Do not click labels/text because one row
  // contains legal links. Check the native inputs directly so Angular receives
  // the input/change events without navigating away from the modal.
  const allRadios = careSurface.locator("input[type='radio']");
  await expect.poll(() => allRadios.count(), {
    timeout: 30000,
    message: "Samsung Care+ should expose the selected plan plus four consent radios.",
  }).toBeGreaterThanOrEqual(5);

  const consentRadios = allRadios.filter({ visible: true });
  const consentCount = await consentRadios.count();
  expect(consentCount).toBeGreaterThanOrEqual(4);

  // The four consent controls are the final four visible radios in the modal.
  // Selecting by input avoids the Material touch-target/label interception.
  for (let index = consentCount - 4; index < consentCount; index += 1) {
    const radio = consentRadios.nth(index);
    await radio.check({ force: true });
    await expect(radio).toBeChecked({ timeout: 10000 });
  }

  const confirm = careSurface
    .getByRole("button", { name: /Agregar al carrito|Añadir al carrito/i })
    .filter({ visible: true })
    .last();
  await expect(confirm).toBeVisible({ timeout: 30000 });
  await expect(confirm).toBeEnabled({ timeout: 30000 });
  await confirm.click();

  await expect(careSurface).toBeHidden({ timeout: 30000 });

  const summaryWarranty = page
    .getByText(/Samsung Care.*Garant[ií]a extendida|Garant[ií]a extendida/i)
    .filter({ visible: true });
  await expect(summaryWarranty.first()).toBeVisible({ timeout: 30000 });

  const totalAfter = parseMxCurrency(await totalHeading.locator("..").innerText());
  expect(totalAfter).not.toBeNull();
  expect(totalAfter).toBeGreaterThan(totalBefore);

  recordBusinessEvidence(testInfo, {
    configuredSku: mxConfig.sku,
    service: "Samsung Care+",
    plan: "Garantía extendida",
    acceptedCareTerms: true,
    totalBefore,
    totalAfter,
    priceChanged: true,
  });
});
