import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../../utils/mxConfig";

const { getMxConfig } = mxConfigModule;

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
});

export { expect };
