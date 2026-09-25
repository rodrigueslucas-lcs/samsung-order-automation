import { expect, test as base } from "@playwright/test";
import authState from "../../../../../utils/authState";
import eppConfigModule from "../../../../../utils/eppConfig";

const { AUTH_STATE_PATH, applyAuthSessionStorage, hasAuthState } = authState;
const { resolveEppConfig } = eppConfigModule;
const runtimeConfig = resolveEppConfig();

export const test = base.extend({
  eppConfig: async ({ context }, use, testInfo) => {
    testInfo.skip(
      !runtimeConfig.configured,
      "EPP staging is not configured. Set EPP_STOREFRONT_URL."
    );
    if (hasAuthState() && runtimeConfig.hostname === "stg2.shop.samsung.com") {
      await applyAuthSessionStorage(context);
    }
    await use(runtimeConfig);
  },
  eppSmokeConfig: async ({ eppConfig }, use, testInfo) => {
    const missing = [];
    if (!eppConfig.smokeSku) missing.push("EPP_SMOKE_SKU");
    if (!eppConfig.smokePdpUrl) missing.push("EPP_SMOKE_PDP_URL");
    if (!eppConfig.cartUrl) missing.push("EPP_CART_URL");
    testInfo.skip(Boolean(missing.length), `Missing EPP cart configuration: ${missing.join(", ")}.`);
    await use(eppConfig);
  },
});

test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

export { expect };
