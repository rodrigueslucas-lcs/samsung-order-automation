import { test, expect } from "@playwright/test";
import marketConfigModule from "../../../../../config/markets/index";
import storefrontAccess from "../../../../../flows/smb/storefrontAccess";

const { getMarketConfig } = marketConfigModule;
const { openStorefront } = storefrontAccess;

const BASIC_MARKETS = [
  { code: "CL", env: "CL_STOREFRONT_URL" },
  { code: "CO", env: "CO_STOREFRONT_URL" },
];

for (const market of BASIC_MARKETS) {
  test(`${market.code} @qst @${market.code.toLowerCase()} @base-store @safe - storefront basic loading`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    test.skip(!process.env[market.env], `${market.env} is required.`);

    const config = getMarketConfig(market.code);
    const loaded = await openStorefront(page, {
      baseUrl: config.baseUrl,
      expectedMarket: market.code,
    });

    await expect(page.getByRole("main")).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("banner")).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("contentinfo")).toBeVisible({ timeout: 60000 });

    const maintenance = page.getByText(/SystemParking|Page Under Maintenance/i).filter({ visible: true });
    await expect(maintenance).toHaveCount(0);

    testInfo.annotations.push({ type: "market", description: market.code });
    testInfo.annotations.push({ type: "environment", description: "S1" });
    testInfo.annotations.push({
      type: "qst-reuse-note",
      description: `Basic ${market.code} storefront loading only. This does not claim Full coverage for any official Zephyr TC until the corresponding Expected Result is asserted and live-proven.`,
    });

    expect(loaded.pathname.toLowerCase()).toBe(`/${market.code.toLowerCase()}/`);
  });
}
