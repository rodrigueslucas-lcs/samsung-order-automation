const { getPreqa2Config } = require("./preqa2Config");

function isWmcLoginGate(url, pageText = "") {
  return /\/apps\/samsung\/login\//i.test(String(url)) ||
    /Please login through WMC/i.test(String(pageText));
}

async function assertPreqa2Session(page, config) {
  const currentUrl = page.url();
  const pageText = await page.locator("body").innerText().catch(() => "");
  if (isWmcLoginGate(currentUrl, pageText)) {
    throw new Error(
      "PreQA2 requires a legitimate WMC-authenticated browser session. " +
      "Complete Samsung Employees -> AD SSO Login -> QA -> Preqa2 in the same browser context before running discovery."
    );
  }

  const current = new URL(currentUrl);
  if (current.protocol !== "https:" || current.hostname !== config.hostname) {
    throw new Error(`PreQA2 navigation left the approved host ${config.hostname}.`);
  }
}

async function bootstrapPreqa2Market(page, options = {}) {
  const config = getPreqa2Config(options.environment);
  await page.goto(config.sitesUrl.toString(), { waitUntil: "domcontentloaded" });
  await assertPreqa2Session(page, config);

  await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await assertPreqa2Session(page, config);

  await page.goto(config.storefrontUrl.toString(), { waitUntil: "domcontentloaded" });
  await assertPreqa2Session(page, config);

  const finalUrl = new URL(page.url());
  if (!finalUrl.pathname.toLowerCase().startsWith(`/${config.market.toLowerCase()}/`)) {
    throw new Error(`PreQA2 did not open the ${config.market} storefront route.`);
  }

  return config;
}

module.exports = { assertPreqa2Session, bootstrapPreqa2Market, isWmcLoginGate };
