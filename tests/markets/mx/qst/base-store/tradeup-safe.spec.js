import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart, openMxService } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-24982 @qst @mx @base-store @safe - Trade-up interaction preserves controlled cart", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24982"));

  let cart;
  await test.step("Prepare and validate the controlled MX cart", async () => {
    cart = await prepareMxQstCart(page, mxConfig);
    await cart.validateControlledSingleSku(mxConfig.sku);
  });

  let surface;
  await test.step("Open the Galaxy Canje trade-up journey", async () => {
    surface = await openMxService(page, "Galaxy Canje");
    await expect(
      page.getByText(/Selecciona el dispositivo/i).filter({ visible: true }).last()
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText(/Recibe una oferta por tu dispositivo actual/i).filter({ visible: true }).last()
    ).toBeVisible({ timeout: 30000 });
    const continueButton = page
      .getByRole("button", { name: /Continuar/i })
      .filter({ visible: true })
      .last();
    await expect(continueButton).toBeVisible();
  });

  await test.step("Close the trade-up journey without mutating the cart", async () => {
    const close = surface
      .getByRole("button", { name: /cerrar|close/i })
      .or(page.getByRole("button", { name: /cerrar|close/i }).filter({ visible: true }))
      .first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
    } else {
      await page.keyboard.press("Escape");
    }
  });

  await test.step("Validate the original controlled cart is preserved", async () => {
    await expect(page).toHaveURL(/\/mx\/cart/i);
    await cart.validateControlledSingleSku(mxConfig.sku);
  });

  recordBusinessEvidence(testInfo, {
    tradeUpSurfaceOpened: true,
    controlledSkuPreserved: mxConfig.sku,
  });
});
