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

  const planTouchTarget = planCard.locator(".mat-mdc-radio-touch-target").first();
  if (await planTouchTarget.count()) {
    await planTouchTarget.click();
  } else {
    await planCard.click();
  }

  const termsSection = careSurface.getByText(/T[eé]rminos y condiciones de Samsung Care\+/i).first();
  await expect(termsSection).toBeVisible({ timeout: 30000 });

  // The consent copy contains legal links. Clicking the label text can open the
  // Samsung Care+ legal page instead of selecting the control. Target only the
  // four Material radio controls that belong to the terms section.
  const consentTexts = [
    /He tomado nota/i,
    /He le[ií]do y estoy de acuerdo/i,
    /Entiendo que es una p[oó]liza/i,
    /Declaro que tengo m[aá]s de 18 a[nñ]os/i,
  ];

  for (const consentText of consentTexts) {
    const consentRow = careSurface
      .getByText(consentText)
      .filter({ visible: true })
      .first()
      .locator("xpath=ancestor::*[.//input[@type='radio'] or .//input[@type='checkbox']][1]");
    await expect(consentRow).toBeVisible({ timeout: 30000 });

    const input = consentRow.locator("input[type='radio'], input[type='checkbox']").first();
    await expect(input).toBeAttached({ timeout: 30000 });

    if (!(await input.isChecked())) {
      const touchTarget = consentRow.locator(".mat-mdc-radio-touch-target, .mat-mdc-checkbox-touch-target").first();
      if (await touchTarget.count()) {
        await touchTarget.click();
      } else {
        await input.check({ force: true });
      }
    }

    await expect(input).toBeChecked({ timeout: 10000 });
  }

  const confirm = careSurface
    .getByRole("button", { name: /Agregar al carrito|Añadir al carrito|Confirmar|Aplicar/i })
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
