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

  // The live Samsung Care+ UI uses a custom visual radio. Clicking the native
  // input with force can change the DOM state without triggering the Angular
  // selection handler, leaving "Agregar al carrito" disabled. Click the plan
  // card/visual radio as a user would instead.
  const planCard = extendedWarrantyPlan.locator(
    "xpath=ancestor::*[.//input[@type='radio'] or .//*[@role='radio']][1]"
  );
  await expect(planCard).toBeVisible({ timeout: 30000 });

  const visualRadio = planCard.getByRole("radio").filter({ visible: true }).first();
  if (await visualRadio.count()) {
    await visualRadio.click();
  } else {
    await planCard.click();
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
    totalBefore,
    totalAfter,
    priceChanged: true,
  });
});
