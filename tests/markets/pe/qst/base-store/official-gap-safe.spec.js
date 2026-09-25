import { test, expect } from "@playwright/test";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import PaymentPage from "../../../../../pages/PaymentPage";
import OrderConfirmationPage from "../../../../../pages/OrderConfirmationPage";
import { addConfiguredProductToPeCart, reachPeGuestPayment } from "./peQstFlows";

const { getPeQstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;
const { requirePaymentSubmitOptIn } = destructiveGuards;

function config() {
  test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required.");
  return getPeQstConfig();
}
function evidence(testInfo, id) {
  recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata(id));
}

test.describe("PE QST - official safe gap reconciliation", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25065 @qst @pe @base-store @safe - Verify rewards as a rewards user baseline", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25065");
    const cfg = config();
    const cart = await addConfiguredProductToPeCart(page, cfg);
    const rewards = page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({ visible: true });
    await expect(rewards.first()).toBeVisible({ timeout: 30000 });
    await cart.proceedToCheckout();
    await expect(page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    testInfo.annotations.push({ type: "qst-reuse-note", description: "Cart and checkout Rewards text are proven safely; payment-page Rewards text/tooltip still requires a rewards-capable authenticated runtime." });
  });

  test("SAM-25068 @qst @pe @base-store @safe - Verify BOGO product on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25068");
    const cfg = config();
    const bogoPdp = process.env.PE_QST_BOGO_PDP_URL;
    test.skip(!bogoPdp, "PE_QST_BOGO_PDP_URL must identify a currently eligible PE BOGO product; stale campaign SKUs are not hardcoded.");
    const target = new URL(bogoPdp);
    if (target.hostname !== cfg.baseUrl.hostname || !target.pathname.startsWith("/pe/")) throw new Error("PE_QST_BOGO_PDP_URL must stay on the configured PE staging storefront.");
    const bogoCfg = { ...cfg, pdpUrl: target, sku: process.env.PE_QST_BOGO_SKU || cfg.sku };
    await addConfiguredProductToPeCart(page, bogoCfg);
    await expect(page.getByText(/BOGO|gratis|gratuito|free|promoci[oó]n/i).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
  });

  test("SAM-25074 @qst @pe @base-store @safe - SC+ on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25074");
    const cfg = config();
    await addConfiguredProductToPeCart(page, cfg);
    const care = page.getByText(/Samsung Care\+|SC\+/i).filter({ visible: true });
    test.skip(!(await care.count()), "Configured PE SKU does not currently expose SC+; provide a verified SC+-eligible PE_QST_PDP_URL/PE_QST_SKU.");
    await expect(care.first()).toBeVisible();
    testInfo.annotations.push({ type: "qst-reuse-note", description: "SC+ availability is proven without mutating cart services; add/remove persistence remains runtime acceptance work." });
  });

  test("SAM-25075 @qst @pe @base-store @safe - Verify Trade-in on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25075");
    const cfg = config();
    const cart = await addConfiguredProductToPeCart(page, cfg);
    await cart.openTradeInJourney();
    await cart.completeTradeInJourney();
    await cart.validateTradeInAdded();
    await cart.validateTradeInSummaryAmount();
  });

  test("SAM-25076 @qst @pe @base-store @safe - Verify Trade-up on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25076");
    const cfg = config();
    const cart = await addConfiguredProductToPeCart(page, cfg);
    await cart.validateControlledSingleSku(cfg.sku);

    const tradeUp = page
      .getByText(/Plan Canje Galaxy|Plan Renueva|Canje Galaxy|Trade[- ]?up/i)
      .filter({ visible: true })
      .first();
    await expect(tradeUp, "The validated PE Flip6 cart should expose the Trade-up/Plan Canje surface.").toBeVisible({ timeout: 30000 });

    const serviceCard = tradeUp.locator("xpath=ancestor::*[.//*[normalize-space()='Añadir']][1]");
    const add = serviceCard.getByText(/Añadir|Agregar/i, { exact: true }).filter({ visible: true }).first();
    await expect(add).toBeVisible({ timeout: 30000 });
    await add.click();

    await expect(
      page.getByText(/Selecciona el dispositivo|Recibe una oferta|dispositivo actual|Plan Canje/i)
        .filter({ visible: true })
        .last()
    ).toBeVisible({ timeout: 30000 });

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/pe\/cart/i);
    await cart.validateControlledSingleSku(cfg.sku);
    recordBusinessEvidence(testInfo, { tradeUpSurfaceOpened: true, controlledSkuPreserved: cfg.sku });
  });

  test("SAM-25099 @destructive @qst @pe @base-store - Verify Order Confirmation page", async ({ page }, testInfo) => {
    test.setTimeout(600000);
    requirePaymentSubmitOptIn();
    evidence(testInfo, "SAM-25099");
    const cfg = config();
    const { payment } = await reachPeGuestPayment(page, cfg, { expectedPaymentMode: /^Banca por Internet\b/i });
    await payment.selectBancaPorInternet();
    const result = await payment.submitSelectedPaymentMode();
    expect(result.orderCode, `Authorized PE order submit produced no observable order code. Outcome: ${result.type}`).toMatch(/^PE\d{6}-\d{8}(?:_\d+)?$/i);

    if (/confirmation|confirmacion|order-confirmation|checkout\/order|success/i.test(page.url())) {
      const confirmation = new OrderConfirmationPage(page);
      const confirmationOrder = await confirmation.validateOrderCreated();
      expect(confirmationOrder).toContain(result.orderCode.replace(/^PE/i, ""));
    }

    recordBusinessEvidence(testInfo, {
      orderCode: result.orderCode,
      outcome: result.type,
      paymentMode: "Banca por Internet",
      authorizedSubmit: true,
    });
  });

  test("SAM-25094 @qst @pe @base-store @safe - Verify Back to Top", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25094");
    const cfg = config();
    await addConfiguredProductToPeCart(page, cfg);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i.test(document.body.innerText);
    }, null, { timeout: 60000, polling: "raf" });
    const backToTop = page.getByRole("button", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i })
      .or(page.getByRole("link", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i }))
      .filter({ visible: true });
    await expect(backToTop.first()).toBeVisible({ timeout: 30000 });
  });
});
