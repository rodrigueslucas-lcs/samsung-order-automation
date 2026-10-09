import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
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
  // Keep the legacy Service Pack label, and recognize S2's Select AI plan.
  // Do not select the unrelated ultrasonic-maintenance option.
  const planRadio = careSurface.getByRole("radio", {
    name: /Service Pack|Select AI:\s*Suscripci[oó]n mensual por 36 meses/i,
  });
  await expect(planRadio).toHaveCount(1, { timeout: 30000 });
  await expect(planRadio).toBeVisible({ timeout: 30000 });
  const planOption = planRadio.locator("xpath=ancestor::mat-radio-button[1]");
  const selectedPlan = (await planOption.locator(".option-box__name").innerText()).trim();
  const planSku = (await planOption.locator(".option-box__code").innerText()).trim();
  const priceText = await planOption.locator(".option-box__price").innerText();
  const planPrice = parseMxCurrency(priceText.match(/\$\s*[\d,.]+/g)?.at(-1));
  expect(planSku, "The selected service must identify its SKU.").toBeTruthy();
  expect(planPrice, "The selected service must expose a positive price.").toBeGreaterThan(0);
  await planRadio.check({ force: true });
  await expect(planRadio).toBeChecked({ timeout: 10000 });

  const termsSection = careSurface.getByText(/T[eé]rminos y condiciones de nuestros Servicios Adicionales/i).first();
  await expect(termsSection).toBeVisible({ timeout: 30000 });

  const confirm = careSurface
    .getByRole("button", { name: /Agregar al carrito|Añadir al carrito/i })
    .filter({ visible: true })
    .last();
  await expect(confirm).toBeDisabled();
  const consents = careSurface.getByRole("checkbox").filter({ visible: true });
  expect(await consents.count(), "Servicios Adicionales must require its legal consents.").toBeGreaterThanOrEqual(3);
  for (let index = 0; index < await consents.count(); index += 1) {
    const consent = consents.nth(index);
    await consent.check();
    await expect(consent).toBeChecked({ timeout: 10000 });
  }

  await expect(confirm).toBeVisible({ timeout: 30000 });
  await expect(confirm).toBeEnabled({ timeout: 30000 });
  await confirm.click();

  await expect(careSurface).toBeHidden({ timeout: 30000 });

  const summary = page.getByRole("heading", { name: /Resumen de tu pedido/i }).locator("..");
  const summaryWarranty = summary.getByText(selectedPlan, { exact: true });
  const assertAddedPlan = async () => {
    await expect(summaryWarranty).toBeVisible({ timeout: 30000 });
    await expect.poll(async () =>
      parseMxCurrency(await summaryWarranty.locator("..").innerText()),
      { message: "The order summary must charge the selected plan price.", timeout: 30000 }
    ).toBe(planPrice);
    await expect(productCard.getByRole("button", { name: /Remove Servicios Adicionales/i }))
      .toBeVisible({ timeout: 30000 });
    await expect(productCard.getByRole("textbox", { name: "Quantity", exact: true })).toHaveValue("1");
    await expect.poll(async () =>
      parseMxCurrency(await totalHeading.locator("..").innerText()),
      { message: "The cart total must increase by exactly the selected service price.", timeout: 30000 }
    ).toBeCloseTo(totalBefore + planPrice, 2);
  };
  await assertAddedPlan();
  const totalAfter = parseMxCurrency(await totalHeading.locator("..").innerText());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await assertAddedPlan();

  recordBusinessEvidence(testInfo, {
    configuredSku: warrantySku,
    service: "Servicios Adicionales",
    plan: selectedPlan,
    planSku,
    planPrice,
    acceptedCareTerms: true,
    totalBefore,
    totalAfter,
    priceChanged: true,
    persistedAfterReload: true,
  });
  console.log("MX_QST_EXTENDED_WARRANTY", JSON.stringify({
    plan: selectedPlan, planSku, planPrice, totalBefore, totalAfter, persistedAfterReload: true,
  }));
});
