import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../../utils/mxConfig";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";

const { getMxConfig } = mxConfigModule;
const { assertMxStagingPage } = mxStagingGuard;

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
  mxStagingSession: [async ({ page, mxConfig }, use, testInfo) => {
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
      throw new Error(
        `MX ${mxConfig.environment} getcookie bootstrap did not become ready after one controlled retry: ${bootstrapError.message}`
      );
    }
    await page.goto(mxConfig.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertMxStagingPage(page, "MX QST bootstrap");
    await use();
    // Tracking legitimately visits Mercado Pago. If its prerequisite failed
    // there, keep that primary failure instead of replacing it with the MX
    // storefront guard's wrong-host error.
    const paymentTc = testInfo.title.includes("SAM-25002") || testInfo.title.includes("SAM-25010");
    if (paymentTc && process.env.ALLOW_PAYMENT_SUBMIT === "1" && testInfo.status === "failed" &&
        new URL(page.url()).hostname === "www.mercadopago.com.mx") return;
    await assertMxStagingPage(page, "MX QST final environment guard");
  }, { auto: true }],
});

export { expect };
