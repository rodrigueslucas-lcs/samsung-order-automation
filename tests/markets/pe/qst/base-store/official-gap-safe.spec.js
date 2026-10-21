import { test, expect } from "@playwright/test";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import peBusinessEvidence from "../../../../../utils/peBusinessEvidence.cjs";
import PaymentPage from "../../../../../pages/PaymentPage";
import OrderConfirmationPage from "../../../../../pages/OrderConfirmationPage";
import { testData } from "../../../../../utils/testData";
import safetyPaySandbox from "../../../../../flows/pe/safetyPaySandbox.cjs";
import peBogoEvidence from "../../../../../flows/pe/bogoEvidence.cjs";
import { addConfiguredProductToPeCart, reachPeGuestPayment } from "./peQstFlows";

const { getPeQstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;
const { requirePaymentSubmitOptIn } = destructiveGuards;
const { captureBusinessExchange, attachOrderEvidence } = peBusinessEvidence;

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
    const cart = await test.step("Prepare PE cart with controlled product", () =>
      addConfiguredProductToPeCart(page, cfg)
    );
    const rewards = page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({ visible: true });
    await test.step("Validate Rewards surface in cart", async () => {
      await expect(rewards.first()).toBeVisible({ timeout: 30000 });
    });
    await test.step("Continue to checkout", () => cart.proceedToCheckout());
    await test.step("Validate Rewards surface in checkout", async () => {
      await expect(page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    });
    testInfo.annotations.push({ type: "qst-reuse-note", description: "Cart and checkout Rewards text are proven safely; payment-page Rewards text/tooltip still requires a rewards-capable authenticated runtime." });
  });

  test("SAM-25068 @qst @pe @base-store @safe - Verify BOGO product on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25068");
    const cfg = config();
    const defaultBogoSku = cfg.environment === "S2" ? "SM-S931BDBLLTP" : "";
    const bogoSku = String(process.env.PE_QST_BOGO_SKU || defaultBogoSku).trim();
    const bogoPdp = process.env.PE_QST_BOGO_PDP_URL ||
      (bogoSku ? new URL(`/pe/p/${bogoSku}`, cfg.baseUrl.origin).href : "");
    test.skip(!bogoPdp || !bogoSku, "A currently eligible PE BOGO product is required for this environment.");

    const target = new URL(bogoPdp);
    if (target.hostname !== cfg.baseUrl.hostname || !target.pathname.startsWith("/pe/")) {
      throw new Error("PE_QST_BOGO_PDP_URL must stay on the configured PE staging storefront.");
    }
    const bogoCfg = { ...cfg, pdpUrl: target, sku: bogoSku };

    const cart = await test.step("Add eligible Galaxy S25 BOGO product to cart", async () => {
      try {
        return await addConfiguredProductToPeCart(page, bogoCfg, {
          addButtonName: /^(?:Preventa|Agregar al (?:carro|carrito)|Add to cart|Add to basket)$/i,
        });
      } catch (error) {
        if (error.code !== "PRODUCT_OUT_OF_STOCK" || error.sku !== bogoSku) throw error;
        test.skip(true, `Missing PE BOGO test data: configured SKU ${bogoSku} is explicitly sold out. Provide a purchasable BOGO-eligible PE_QST_BOGO_SKU/PE_QST_BOGO_PDP_URL.`);
      }
    });
    await test.step("Validate BOGO source product in cart", async () => {
      const sourceSku = page.getByText(bogoSku, { exact: true }).filter({ visible: true });
      await expect(sourceSku.first(), "PE BOGO cart must contain the eligible source SKU.").toBeVisible({ timeout: 30000 });
      expect(await sourceSku.count(), "PE BOGO campaign may repeat the source SKU in paid and promotional cart entries.").toBeGreaterThanOrEqual(1);
    });
    const promotion = await test.step("Validate persisted free BOGO gifts and unchanged cart total", async () => {
      const readback = page.waitForResponse(response => response.request().method() === "GET" &&
        new URL(response.url()).hostname === `${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com` &&
        new URL(response.url()).pathname === "/tokocommercewebservices/v2/pe/users/current/carts/current", { timeout: 60000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      const response = await readback;
      expect(response.status(), "BOGO cart readback must succeed.").toBe(200);
      const expectedGifts = cfg.environment === "S2" && bogoSku === "SM-S931BDBLLTP"
        ? ["SM-S931BDBLLTP", "SM-R630NZAALTA"] : null;
      const proof = peBogoEvidence.validatePeBogoCart(await response.json(), bogoSku, expectedGifts);
      const main = page.getByRole("main");
      for (const gift of proof.gifts) {
        // The API proves promotional identity and zero price; the UI proves each
        // gift entry is rendered, including the free duplicate of the paid SKU.
        await expect(main.getByText(gift.sku, { exact: true }).filter({ visible: true }))
          .toHaveCount(gift.sku === bogoSku ? 2 : 1, { timeout: 30000 });
      }
      const giftLabels = page.getByText(/BOGO\s*Gift/i, { exact: true }).filter({ visible: true });
      return { ...proof, promotionLabelCount: await giftLabels.count() };
    });
    await testInfo.attach("PE BOGO persisted cart proof", { body: JSON.stringify(promotion), contentType: "application/json" });
    recordBusinessEvidence(testInfo, {
      bogoSku,
      bogoPdp: target.href,
      ...promotion,
      freeGiftValidated: true,
    });
  });

  test("SAM-25074 @qst @pe @base-store @safe - SC+ on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25074");
    const cfg = config();
    await test.step("Prepare PE cart with controlled product", () =>
      addConfiguredProductToPeCart(page, cfg)
    );
    const care = page.getByText(/Samsung Care\+|SC\+/i).filter({ visible: true });
    test.skip(!(await care.count()), "Configured PE SKU does not currently expose SC+; provide a verified SC+-eligible PE_QST_PDP_URL/PE_QST_SKU.");
    await test.step("Validate Samsung Care+ surface in cart", async () => {
      await expect(care.first()).toBeVisible();
    });
    testInfo.annotations.push({ type: "qst-reuse-note", description: "SC+ availability is proven without mutating cart services; add/remove persistence remains runtime acceptance work." });
  });

  test("SAM-25075 @qst @pe @base-store @safe - Verify Trade-in on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25075");
    const cfg = config();
    const cart = await test.step("Prepare PE cart with controlled product", () =>
      addConfiguredProductToPeCart(page, cfg)
    );
    await test.step("Open and complete Trade-in journey", async () => {
      await cart.openTradeInJourney();
      await cart.completeTradeInJourney(cfg.environment === "S1"
        ? { modelName: "GALAXY S24 ULTRA 5G", capacity: "Otros", valuation: "S/ 2,200.00" }
        : {});
    });
    await test.step("Validate Trade-in was added to cart", async () => {
      await cart.validateTradeInAdded();
      await cart.validateTradeInSummaryAmount();
    });
  });

  test("SAM-25076 @qst @pe @base-store @safe - Verify Trade-up on cart page", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25076");
    const cfg = config();
    const cart = await test.step("Prepare PE cart with controlled product", () =>
      addConfiguredProductToPeCart(page, cfg)
    );
    await test.step("Validate cart and configured product", async () => {
      await cart.validateCartPage();
      await cart.validateProductInCart();
    });

    const tradeUp = page
      .getByText(/Plan Canje Galaxy|Plan Renueva|Canje Galaxy|Trade[- ]?up/i)
      .filter({ visible: true })
      .first();
    await test.step("Validate Trade-up service is available", async () => {
      await expect(tradeUp, "The validated PE Flip6 cart should expose the Trade-up/Plan Canje surface.").toBeVisible({ timeout: 30000 });
    });

    const serviceCard = tradeUp.locator("xpath=ancestor::*[.//*[normalize-space()='Añadir']][1]");
    const add = serviceCard.getByText(/Añadir|Agregar/i, { exact: true }).filter({ visible: true }).first();
    await expect(add).toBeVisible({ timeout: 30000 });
    await test.step("Open Trade-up journey", async () => {
      await add.click();
      await expect(
        page.getByText(/Selecciona el dispositivo|Recibe una oferta|dispositivo actual|Plan Canje/i)
          .filter({ visible: true })
          .last()
      ).toBeVisible({ timeout: 30000 });
    });

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/pe\/cart/i);
    await cart.validateProductInCart();
    recordBusinessEvidence(testInfo, { tradeUpSurfaceOpened: true, controlledSkuPreserved: cfg.sku });
  });

  test("SAM-25099 @destructive @qst @pe @base-store - Verify Order Confirmation page", async ({ page }, testInfo) => {
    test.setTimeout(600000);
    requirePaymentSubmitOptIn();
    evidence(testInfo, "SAM-25099");
    const cfg = config();
    const useCard = cfg.environment === "S1";
    const { payment } = await reachPeGuestPayment(page, cfg, {
      expectedPaymentMode: useCard ? /Tarjeta de Crédito \/ Débito/i : /^Banca por Internet\b/i,
      requireQuantityOne: true,
    });
    let result;
    if (useCard) {
      await test.step("Prepare known PE test card and validate readiness", async () => {
        await payment.selectCreditCard();
        await payment.fillCardData(testData.card);
        await payment.validateCreditCardReady(testData.card);
      });
      result = await test.step("Submit the authorized PE card payment once", () =>
        captureBusinessExchange(page, testInfo, "Order Submit", () =>
          payment.placeOrderAndCapture({
            orderCodePattern: /\bPE\d{6}-\d{8}(?=_|\b)/i,
            orderResponsePathPattern: /\/users\/[^/]+\/orders(?:\/|$)/i,
            submitResponsePathPattern: /\/users\/[^/]+\/carts\/[^/]+\/paymentmodes\/pe-mercadoCC\/submitOrder$/i,
          }),
          { matcher: /submitOrder|\/orders(?:\/|$)|payment/i, max: 12 }
        )
      );
    } else {
      await test.step("Select Internet Banking", () => payment.selectBancaPorInternet());
      result = await test.step("Submit authorized payment", () =>
        captureBusinessExchange(page, testInfo, "Order Submit", () =>
          payment.submitSelectedPaymentMode(),
          { matcher: /submitOrder|\/orders(?:\/|$)|payment|transaction/i, max: 12 }
        )
      );
    }
    await test.step("Validate created PE order code", async () => {
      expect(result.orderCode, `Authorized PE order submit produced no observable order code. Outcome: ${result.outcome ?? result.type}`).toMatch(/^PE\d{6}-\d{8}(?:_\d+)?$/i);
    });

    await test.step("Validate visible new order confirmation screen", async () => {
      if (!useCard && new URL(page.url()).origin === 'https://sandbox-gateway.safetypay.com') {
        await safetyPaySandbox.completePeSafetyPaySandbox(page, {
          orderCode: result.orderCode, storefrontOrigin: cfg.baseUrl.origin,
        });
      }
      const outcomeUrl = new URL(page.url());
      if (outcomeUrl.hostname !== cfg.baseUrl.hostname) {
        throw new Error(`PE order ${result.orderCode} reached ${outcomeUrl.origin}${outcomeUrl.pathname}; Samsung confirmation remains unproven. Resume the existing attempt before any new submission.`);
      }
      const confirmation = new OrderConfirmationPage(page);
      const confirmationOrder = await confirmation.validateOrderCreated();
      const baseOrderCode = result.orderCode.match(/^PE\d{6}-\d{8}/i)[0];
      expect(confirmationOrder).toContain(baseOrderCode.replace(/^PE/i, ""));
    });

    const paymentMode = useCard ? "Tarjeta de Crédito / Débito" : "Banca por Internet";
    await attachOrderEvidence(testInfo, {
      sku: cfg.sku,
      orderCode: result.orderCode,
      outcome: result.outcome ?? result.type,
      paymentMode,
      finalUrl: result.finalUrl || `${new URL(page.url()).origin}${new URL(page.url()).pathname}`,
      networkSummary: result.responses || [],
      authorizedSubmit: true,
      confirmationValidated: true,
    });
    recordBusinessEvidence(testInfo, {
      sku: cfg.sku,
      orderCode: result.orderCode,
      outcome: result.outcome ?? result.type,
      paymentMode,
      authorizedSubmit: true,
      confirmationValidated: true,
    });
  });

  test("SAM-25094 @qst @pe @base-store @safe - Verify Back to Top", async ({ page }, testInfo) => {
    evidence(testInfo, "SAM-25094");
    const cfg = config();
    await test.step("Prepare PE cart with controlled product", () =>
      addConfiguredProductToPeCart(page, cfg)
    );
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i.test(document.body.innerText);
    }, null, { timeout: 60000, polling: "raf" });
    const backToTop = page.getByRole("button", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i })
      .or(page.getByRole("link", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i }))
      .filter({ visible: true });
    await test.step("Validate Back to Top control", async () => {
      await expect(backToTop.first()).toBeVisible({ timeout: 30000 });
    });
  });
});
