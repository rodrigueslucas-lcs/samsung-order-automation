import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../../utils/mxConfig";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";

const { getMxConfig } = mxConfigModule;
const { assertMxStagingPage } = mxStagingGuard;

export const test = base.extend({
  mxConfig: async ({}, use) => {
    const baseConfig = getMxConfig();
    const sku = "SM-F741BLBKLTM";
    await use({
      ...baseConfig,
      sku,
      pdpUrl: new URL(`/mx/p/${sku}`, baseConfig.baseUrl.origin),
    });
  },
  mxStagingSession: [async ({ page, mxConfig }, use, testInfo) => {
    await page.goto(mxConfig.bootstrapUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText(/You can access pages now/i).waitFor({ state: "visible", timeout: 60000 });
    await page.goto(mxConfig.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertMxStagingPage(page, "MX QST bootstrap");
    await use();
    // Tracking legitimately visits Mercado Pago. If its prerequisite failed
    // there, keep that primary failure instead of replacing it with the MX
    // storefront guard's wrong-host error.
    if (testInfo.title.includes("SAM-25010") && testInfo.status === "failed" &&
        new URL(page.url()).hostname === "www.mercadopago.com.mx") return;
    await assertMxStagingPage(page, "MX QST final environment guard");
  }, { auto: true }],
});

export { expect };
