import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import ProductPage from "../../../../../pages/ProductPage";
import { test, expect } from "./mxQst.fixture";
import { mxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

function parseMxCurrency(text) {
  const match = String(text || "").match(/\$\s*([\d,.]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

test.describe.configure({ timeout: 420000 });

test("SAM-24985 @qst @mx @base-store @safe - Extended Warranty on Cart", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24985"));
  const warrantySku = process.env.MX_QST_EXTENDED_WARRANTY_SKU || "WD26DB8995BZAX";
  const warrantyConfig = {
    ...mxConfig,
    sku: warrantySku,
    pdpUrl: new URL(`/mx/p/${warrantySku}`, mxConfig.baseUrl.origin),
  };
  const cart = mxQstCart(page, warrantyConfig);
  await cart.clearMxCartAndConfirmEmpty();
  const product = new ProductPage(page, {
    setupUrl: warrantyConfig.bootstrapUrl.toString(),
    sku: warrantySku,
    pdpUrl: warrantyConfig.pdpUrl.toString(),
    cartUrl: warrantyConfig.cartUrl.toString(),
  });
  await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  await cart.validateControlledSingleSku(warrantySku);

  const totalHeading = page.getByRole("heading", { name: /Total con IVA/i });
  await expect(totalHeading).toBeVisible({ timeout: 30000 });
  const totalBefore = parseMxCurrency(await totalHeading.locator("..").innerText());
  expect(totalBefore).not.toBeNull();

  const productCard = page.locator("div.cart-item", { hasText: warrantySku }).filter({ visible: true }).first();
  const warrantyAction = productCard.locator('button[data-an-la="add service:warranty"]');
  await expect(warrantyAction, "The eligible appliance must expose Servicios Adicionales.").toBeVisible();
  await warrantyAction.click();
  const careSurface = page.getByRole("dialog", { name: /Servicios Adicionales/i }).filter({ visible: true }).first();
  await expect(careSurface).toBeVisible({ timeout: 30000 });

  const planRadio = careSurface.getByRole("radio", { name: /Service Pack/i }).first();
  await expect(planRadio).toBeVisible({ timeout: 30000 });
  const selectedPlan = ((await planRadio.getAttribute("aria-label")) ||
    (await planRadio.locator("xpath=..").innerText())).replace(/\s+/g, " ").trim();
  await planRadio.check({ force: true });
  await expect(planRadio).toBeChecked({ timeout: 10000 });

  const termsSection = careSurface.getByText(/T[eé]rminos y condiciones de nuestros Servicios Adicionales/i).first();
  await expect(termsSection).toBeVisible({ timeout: 30000 });

  const consents = careSurface.getByRole("checkbox").filter({ visible: true });
  expect(await consents.count(), "Servicios Adicionales must require its legal consents.").toBeGreaterThanOrEqual(3);
  for (let index = 0; index < await consents.count(); index += 1) {
    const consent = consents.nth(index);
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
    .getByText(/Service Pack\s*\$\s*[\d,.]+/i)
    .filter({ visible: true });
  await expect(summaryWarranty.first()).toBeVisible({ timeout: 30000 });

  const totalAfter = parseMxCurrency(await totalHeading.locator("..").innerText());
  expect(totalAfter).not.toBeNull();
  expect(totalAfter).toBeGreaterThan(totalBefore);

  recordBusinessEvidence(testInfo, {
    configuredSku: warrantySku,
    service: "Servicios Adicionales",
    plan: selectedPlan,
    acceptedCareTerms: true,
    totalBefore,
    totalAfter,
    priceChanged: true,
  });
});
