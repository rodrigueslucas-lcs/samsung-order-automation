import { expect, test } from "@playwright/test";
import eppConfig from "../../../../utils/eppConfig";

const { resolveEppConfig } = eppConfig;
const config = resolveEppConfig();

test.describe("DST EPP - staging bootstrap", () => {
  test("EPP-BOOTSTRAP - configured storefront is a usable non-Production page", async ({ page }, testInfo) => {
    test.skip(
      !config.configured,
      "EPP staging is not configured. Set EPP_STOREFRONT_URL after Samsung/Accenture supplies the real route."
    );
    test.setTimeout(120000);

    const response = await page.goto(config.url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const finalUrl = new URL(page.url());

    expect(finalUrl.hostname).toBe(config.hostname);
    expect(response?.status(), "EPP document response must be successful.").toBeLessThan(400);
    await expect(page.locator("body")).not.toHaveText(/^\s*$/);

    await testInfo.attach("epp-bootstrap", {
      body: Buffer.from(
        JSON.stringify(
          {
            origin: finalUrl.origin,
            path: finalUrl.pathname,
            status: response?.status() ?? null,
            siteUidConfigured: Boolean(config.siteUid),
            baseStoreUidConfigured: Boolean(config.baseStoreUid),
            smokeSkuConfigured: Boolean(config.smokeSku),
          },
          null,
          2
        )
      ),
      contentType: "application/json",
    });
  });
});
