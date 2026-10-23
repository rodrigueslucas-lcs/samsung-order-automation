const { chromium } = require("playwright");
const { assertPreqa2Session, isWmcLoginGate } = require("../utils/preqa2Bootstrap");
const { getPreqa2Config, normalizePreqa2Market } = require("../utils/preqa2Config");
const { safePageIdentity } = require("../utils/wmcSessionState");

const endpoint = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";
const market = normalizePreqa2Market(process.env.PREQA2_MARKET || process.env.MARKET || "mx");
const config = getPreqa2Config({ PREQA2_MARKET: market });
const marketLabel = config.market;
const recovery = `Complete WMC -> Samsung Employees -> AD SSO Login -> QA / PreQA2 in the Chrome exposed at ${endpoint}, then keep the dedicated ${marketLabel} tab available.`;

async function main() {
  let browser;
  let temporaryPage;
  try {
    try {
      browser = await chromium.connectOverCDP(endpoint, { timeout: 7000 });
    } catch (error) {
      throw new Error(`CDP endpoint unavailable at ${endpoint}: ${error.message.split("\n")[0]}`);
    }

    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) throw new Error(`No browser context available at ${endpoint}. ${recovery}`);

    console.log(`[preqa2-preflight] Connected to ${endpoint}; market=${marketLabel}; contexts=${contexts.length}; context[0] pages=${context.pages().length}.`);
    console.log(`[preqa2-preflight] Existing pages: ${context.pages().map((page) => safePageIdentity(page.url())).join(", ") || "none"}.`);

    // Validate this market in a throwaway page. Never navigate, reuse or close an
    // existing market lane because other Jenkins builds may be attached to it.
    temporaryPage = await context.newPage();
    try {
      await temporaryPage.goto(config.storefrontUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (error) {
      throw new Error(`PreQA2 ${marketLabel} navigation failed: ${error.message.split("\n")[0]}`);
    }

    const finalUrl = temporaryPage.url();
    const bodyText = await temporaryPage.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    if (isWmcLoginGate(finalUrl, bodyText)) {
      throw new Error(`WMC/PreQA2 session expired or unauthenticated for ${marketLabel}. ${recovery}`);
    }
    let final;
    try {
      final = new URL(finalUrl);
    } catch {
      throw new Error(`Unexpected final PreQA2 host for ${marketLabel}: ${safePageIdentity(finalUrl)}. ${recovery}`);
    }
    const expectedPath = `/${market}/`;
    if (final.protocol !== "https:" || final.hostname !== config.hostname || !final.pathname.toLowerCase().startsWith(expectedPath)) {
      throw new Error(`Unexpected final PreQA2 ${marketLabel} host/route: ${safePageIdentity(finalUrl)}. ${recovery}`);
    }

    await assertPreqa2Session(temporaryPage, config);
    try {
      await temporaryPage.locator("nav, [role='navigation'], [class*='gnb']")
        .filter({ visible: true }).first().waitFor({ state: "visible", timeout: 15000 });
    } catch {
      throw new Error(`PreQA2 ${marketLabel} storefront did not render its navigation at ${safePageIdentity(temporaryPage.url())}. ${recovery}`);
    }
    await assertPreqa2Session(temporaryPage, config);
    console.log(`[preqa2-preflight] PASS: authenticated ${marketLabel} storefront rendered at ${safePageIdentity(temporaryPage.url())}.`);
  } finally {
    // On a CDP attachment browser.close() disconnects this Playwright client;
    // it does not terminate the externally launched Chrome. Only our temporary
    // validation page is closed. Existing MX/PE/CO/CL lanes remain untouched.
    if (temporaryPage) await temporaryPage.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`[preqa2-preflight] PREQA2 PREFLIGHT FAILURE: ${error.message}`);
  process.exitCode = 1;
});
