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
  mxStagingSession: [async ({ page, mxConfig }, use) => {
    await page.goto(mxConfig.bootstrapUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText(/You can access pages now/i).waitFor({ state: "visible", timeout: 60000 });
    await page.goto(mxConfig.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertMxStagingPage(page, "MX QST bootstrap");
    await use();
    await assertMxStagingPage(page, "MX QST final environment guard");
  }, { auto: true }],
});

export { expect };
