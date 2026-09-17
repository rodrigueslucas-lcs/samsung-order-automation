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

  // Click the Material control, not its hidden native input. This mirrors the
  // real user interaction and lets Angular update the selected-plan state.
  const planRadio = planCard.locator("mat-radio-button").first();
  if (await planRadio.count()) {
    await planRadio.locator("label, .mat-mdc-radio-touch-target").first().click();
  } else {
    await planCard.click();
  }

  const planInput = planCard.locator("input[type='radio']").first();
  await expect(planInput).toBeChecked({ timeout: 10000 });

  const termsSection = careSurface.getByText(/T[eé]rminos y condiciones de Samsung Care\+/i).first();
  await expect(termsSection).toBeVisible({ timeout: 30000 });

  // The four legal consents are checkboxes, distinct from the plan radios.
  // Use their accessible names so the legal links are not clicked.
  const consentCopies = [
    /He tomado nota de las condiciones generales del seguro/i,
    /He le[ií]do y estoy de acuerdo los T[eé]rminos y Condiciones/i,
    /Entiendo que es una p[oó]liza de seguro con un plazo fijo/i,
    /Declaro que tengo m[aá]s de 18 a[nñ]os/i,
  ];

  for (const copy of consentCopies) {
    const consent = careSurface.getByRole("checkbox", { name: copy }).first();
    await expect(consent).toBeVisible({ timeout: 30000 });
    await consent.check();
    await expect(consent).toBeChecked({ timeout: 10000 });
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
