import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../../utils/mxConfig";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";
import { attachNetworkEvidence } from "../../../../../utils/networkEvidence";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";

const { getMxConfig } = mxConfigModule;
const { assertMxStagingPage } = mxStagingGuard;
const { recordBusinessEvidence } = evidenceContext;

function classifyBusinessApi(response) {
  const request = response.request();
  const method = request.method();
  const url = response.url();

  if (/\/users\/current\/carts(?:\/[^/]+)?(?:\/entries(?:\/\d+)?)?(?:\?|$)/i.test(url)) {
    return `Cart ${method}`;
  }
  if (/getAddressForWardPostCode/i.test(url)) return "Postal code lookup";
  if (/delivery|deliverymodes|address/i.test(url) && /\/v2\/mx\//i.test(url)) return `Delivery ${method}`;
  if (/checkout/i.test(url) && /\/mx\//i.test(url)) return `Checkout ${method}`;
  if (/payment|submitOrder/i.test(url) && /\/mx\//i.test(url)) return `Payment ${method}`;
  if (/\/users\/current\/orders(?:\/|\?|$)/i.test(url)) return `Order ${method}`;
  return null;
}

export const test = base.extend({
  mxConfig: async ({}, use) => {
    const baseConfig = getMxConfig();
    const sku = process.env.MX_QST_SKU || baseConfig.sku;
    await use({
      ...baseConfig,
      sku,
      pdpUrl: new URL(`/mx/p/${sku}`, baseConfig.baseUrl.origin),
    });
  },
  qstBusinessScenario: [async ({}, use, testInfo) => {
    const samId = testInfo.title.match(/SAM-\d+/)?.[0];
    const businessTitle = testInfo.title.includes(" - ")
      ? testInfo.title.split(" - ").slice(1).join(" - ")
      : "Execute and validate MX QST business scenario";
    await base.step(`${samId ? `${samId} · ` : ""}${businessTitle}`, async () => {
      await use();
    });
  }, { auto: true }],
  mxStagingSession: [async ({ page, mxConfig }, use, testInfo) => {
    recordBusinessEvidence(testInfo, {
      market: "MX",
      environment: mxConfig.environment,
      sku: mxConfig.sku,
      pdpUrl: mxConfig.pdpUrl.href,
    });
    await testInfo.attach("MX Test Context", {
      body: Buffer.from(JSON.stringify({
        market: "MX",
        environment: mxConfig.environment,
        sku: mxConfig.sku,
        pdpUrl: `${mxConfig.pdpUrl.origin}${mxConfig.pdpUrl.pathname}`,
      }, null, 2)),
      contentType: "application/json",
    });

    const evidenceTasks = [];
    const evidenceCounts = new Map();
    const onResponse = (response) => {
      const kind = classifyBusinessApi(response);
      if (!kind || evidenceTasks.length >= 24) return;
      const count = (evidenceCounts.get(kind) || 0) + 1;
      evidenceCounts.set(kind, count);
      evidenceTasks.push(
        attachNetworkEvidence(testInfo, `${kind} #${count}`, { response })
      );
    };
    page.on("response", onResponse);

    let bootstrapError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await page.goto(mxConfig.bootstrapUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.getByText(/You can access pages now/i).waitFor({ state: "visible", timeout: 60000 });
        bootstrapError = null;
        break;
      } catch (error) {
        bootstrapError = error;
        if (attempt === 2) break;
      }
    }
    if (bootstrapError) {
      page.off("response", onResponse);
      throw new Error(
        `MX ${mxConfig.environment} getcookie bootstrap did not become ready after one controlled retry: ${bootstrapError.message}`
      );
    }
    await page.goto(mxConfig.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertMxStagingPage(page, "MX QST bootstrap");
    await use();

    page.off("response", onResponse);
    await Promise.allSettled(evidenceTasks);

    const paymentTc = testInfo.title.includes("SAM-25002") || testInfo.title.includes("SAM-25010");
    if (paymentTc && process.env.ALLOW_PAYMENT_SUBMIT === "1" && testInfo.status === "failed" &&
        new URL(page.url()).hostname === "www.mercadopago.com.mx") return;
    await assertMxStagingPage(page, "MX QST final environment guard");
  }, { auto: true }],
});

export { expect };
