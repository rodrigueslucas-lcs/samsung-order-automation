import { test, expect } from "@playwright/test";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { addConfiguredProductToPeCart, reachPeGuestPayment } from "./peQstFlows";

const { getPeQstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

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

  test.skip("SAM-25076 @qst @pe @base-store @not-run - Verify Trade-up on cart page", async ({}, testInfo) => {
    evidence(testInfo, "SAM-25076");
    testInfo.annotations.push({ type: "qst-not-run-reason", description: "Current PE Trade-up semantics and UI are not yet proven in S2; keep explicit in official scope instead of inventing selectors or behavior." });
  });

  test.skip("SAM-25099 @qst @pe @base-store @not-run - Verify Order Confirmation page", async ({}, testInfo) => {
    evidence(testInfo, "SAM-25099");
    testInfo.annotations.push({ type: "qst-not-run-reason", description: "Order Confirmation requires an authorized order-placement prerequisite and current PE confirmation-page proof; keep explicit in official scope until that runtime path is validated." });
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
