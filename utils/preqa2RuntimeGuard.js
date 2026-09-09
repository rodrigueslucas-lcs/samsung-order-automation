const { PREQA2_HOST } = require("./preqa2Config");

function normalizeMarket(value) {
  if (value == null || value === "") return null;
  const market = String(value).trim().toUpperCase();
  if (!["MX", "PE", "CL", "CO"].includes(market)) {
    throw new Error(`Unsupported PreQA2 market guard: ${value}`);
  }
  return market;
}

function assertApprovedPreqa2Url(value, { market = null, allowInfrastructurePath = false } = {}) {
  const url = value instanceof URL ? value : new URL(String(value), `https://${PREQA2_HOST}`);
  if (url.protocol !== "https:" || url.hostname !== PREQA2_HOST) {
    throw new Error(`PreQA2 runtime left approved host https://${PREQA2_HOST}.`);
  }

  const code = normalizeMarket(market);
  if (!code) return url;
  const expectedPrefix = `/${code.toLowerCase()}/`;
  const path = url.pathname.toLowerCase();
  const infrastructure = ["/sites/", "/getcookies", "/apps/samsung/login/"];
  if (!path.startsWith(expectedPrefix)) {
    if (allowInfrastructurePath && infrastructure.some((prefix) => path.startsWith(prefix))) return url;
    throw new Error(`PreQA2 runtime left ${code} storefront route ${expectedPrefix}.`);
  }
  return url;
}

async function assertPageOnPreqa2(page, options = {}) {
  return assertApprovedPreqa2Url(page.url(), options);
}

async function guardedGoto(page, target, { market = null, waitUntil = "domcontentloaded", timeout = 60000 } = {}) {
  const targetUrl = assertApprovedPreqa2Url(target, { market, allowInfrastructurePath: true });
  await page.goto(targetUrl.toString(), { waitUntil, timeout });
  return assertPageOnPreqa2(page, { market });
}

async function guardedInteraction(page, action, { market = null, settle = "domcontentloaded", timeout = 60000 } = {}) {
  if (typeof action !== "function") throw new TypeError("guardedInteraction requires an action function.");
  await assertPageOnPreqa2(page, { market });
  const previousUrl = page.url();
  await action();
  if (page.url() !== previousUrl) {
    await page.waitForLoadState(settle, { timeout }).catch(() => {});
  }
  return assertPageOnPreqa2(page, { market });
}

async function guardedPopupInteraction(page, action, { market = null, timeout = 60000 } = {}) {
  if (typeof action !== "function") throw new TypeError("guardedPopupInteraction requires an action function.");
  await assertPageOnPreqa2(page, { market });
  const popupPromise = page.context().waitForEvent("page", { timeout });
  await action();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded", { timeout }).catch(() => {});
  try {
    assertApprovedPreqa2Url(popup.url(), { market });
  } catch (error) {
    await popup.close().catch(() => {});
    throw error;
  }
  return popup;
}

module.exports = {
  assertApprovedPreqa2Url,
  assertPageOnPreqa2,
  guardedGoto,
  guardedInteraction,
  guardedPopupInteraction,
  normalizeMarket,
};
