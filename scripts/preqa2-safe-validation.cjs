const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { PREQA2_HOST } = require("../utils/preqa2Config");

const CDP_URL = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";
const MARKET = String(process.env.PREQA2_MARKET || "mx").toLowerCase();

function safeUrl(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`;
}

function requirePreqa(page) {
  const url = new URL(page.url());
  assert.equal(url.hostname, PREQA2_HOST, `Navigation left PreQA2: ${safeUrl(page.url())}`);
  assert.match(url.pathname, new RegExp(`^/${MARKET}(?:/|$)`, "i"));
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const authenticatedPage = context.pages().find((candidate) => {
    try { return new URL(candidate.url()).hostname === PREQA2_HOST; } catch { return false; }
  });
  if (!authenticatedPage) throw new Error("An authenticated PreQA2 page is required in the attached Chrome.");
  const page = await context.newPage();
  await page.goto(`https://${PREQA2_HOST}/${MARKET}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  requirePreqa(page);

  const evidence = [];
  const nav = page.getByRole("navigation", { name: /main navigation/i });
  await nav.waitFor({ state: "visible", timeout: 60000 });
  const mobile = nav.locator('button[role="menuitem"][aria-expanded]')
    .and(nav.getByRole("menuitem", { name: "Móviles", exact: true }));
  assert.equal(await mobile.count(), 1, "Expected one expandable Móviles menu control.");
  const category = nav.locator(`a[role="menuitem"][href="/${MARKET}/smartphones/all-smartphones/"]`)
    .and(nav.getByRole("menuitem", { name: "Móviles", exact: true }));
  assert.equal(await category.count(), 1, "Expected one visible Móviles category link.");
  await category.hover();
  await page.waitForFunction(() => [...document.querySelectorAll("button")]
    .some((button) => button.textContent.trim() === "Móviles" && button.getAttribute("aria-expanded") === "true"));
  const categoryHref = await category.getAttribute("href");
  const categoryUrl = new URL(categoryHref, page.url());
  if (categoryUrl.hostname === PREQA2_HOST) {
    await Promise.all([
      page.waitForURL(new RegExp(`/${MARKET}/smartphones/all-smartphones/?$`, "i"), { timeout: 60000 }),
      category.click(),
    ]);
    await page.waitForLoadState("domcontentloaded", { timeout: 60000 });
    requirePreqa(page);
  }
  evidence.push({
    market: MARKET.toUpperCase(),
    officialTcId: "SAM-24964",
    title: "GNB Menu",
    storeContext: "BS",
    s1Coverage: "missing",
    preqa2ExecutionStatus: categoryUrl.hostname === PREQA2_HOST && /\/smartphones\/all-smartphones\/?$/i.test(page.url()) ? "PASS" : "FAIL",
    runtimePath: `/${MARKET}/`,
    userType: "guest",
    evidenceSummary: `Móviles expanded through the semantic main navigation; category target host was ${categoryUrl.hostname}.`,
    automationStatus: "implemented-live-runner",
    blockerDifference: categoryUrl.hostname === PREQA2_HOST ? "" : "The visible GNB category points outside the authoritative PreQA2 host; navigation was not followed.",
    timestamp: new Date().toISOString(),
  });

  requirePreqa(page);
  const filtersHeading = page.getByRole("heading", { name: /^Filtros$/i });
  await filtersHeading.waitFor({ state: "visible", timeout: 60000 });
  const interactiveFilters = page.getByRole("button", { name: /^Filtros?/i })
    .or(page.getByRole("checkbox"))
    .filter({ visible: true });
  evidence.push({
    market: MARKET.toUpperCase(),
    officialTcId: "SAM-24968",
    title: "Facets/Filter",
    storeContext: "BS",
    s1Coverage: "missing",
    preqa2ExecutionStatus: (await interactiveFilters.count()) ? "BLOCKED" : "FAIL",
    runtimePath: `/${MARKET}/smartphones/all-smartphones/`,
    userType: "guest",
    evidenceSummary: `Filtros heading rendered; visible candidate filter controls found: ${await interactiveFilters.count()}. No filter/result transition was proven.`,
    automationStatus: "discovery-only",
    blockerDifference: "Official facet interaction and changed product-set state are not available/proven on this page.",
    timestamp: new Date().toISOString(),
  });

  await page.goto(`https://${PREQA2_HOST}/${MARKET}/smartphones/galaxy-z-flip6/buy/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  requirePreqa(page);
  const storage = page.getByRole("heading", { name: /^Almacenamiento$/i });
  await storage.waitFor({ state: "visible", timeout: 60000 });
  const storageLabels = (await page.locator("label").filter({ visible: true }).allTextContents())
    .map((text) => text.trim().replace(/\s+/g, " "));
  evidence.push({
    market: MARKET.toUpperCase(),
    officialTcId: "DISCOVERY-MX-PDP-VARIANTS",
    title: "PDP storage variants",
    storeContext: "BS",
    s1Coverage: "extra automation",
    preqa2ExecutionStatus: storageLabels.some((text) => /256GB/.test(text)) && storageLabels.some((text) => /512GB/.test(text)) ? "PASS" : "FAIL",
    runtimePath: `/${MARKET}/smartphones/galaxy-z-flip6/buy/`,
    userType: "guest",
    evidenceSummary: `Semantic Almacenamiento section; observed labels: ${storageLabels.filter((text) => /GB/.test(text)).join(" | ")}.`,
    automationStatus: "implemented-live-runner",
    blockerDifference: "Not mapped to an official ID in the current MX 37-case baseline.",
    timestamp: new Date().toISOString(),
  });

  const output = path.resolve("test-results/preqa2/mx-safe-validation.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  await page.close();
}

main().catch((error) => {
  console.error(`[preqa2-safe] ${error.message}`);
  process.exitCode = 1;
});
