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
  const preqaPages = [...context.pages()].reverse().filter((candidate) => {
    try { return new URL(candidate.url()).hostname === PREQA2_HOST; } catch { return false; }
  });
  let authenticatedPage = null;
  for (const candidate of preqaPages) {
    if (new URL(candidate.url()).pathname === `/${MARKET}/` &&
        await candidate.getByText(/Cerrar sesi[oó]n/i).first().isVisible().catch(() => false)) {
      authenticatedPage = candidate;
      break;
    }
  }
  if (!authenticatedPage) throw new Error("An authenticated PreQA2 page is required in the attached Chrome.");
  const page = authenticatedPage;
  await page.bringToFront();
  requirePreqa(page);

  const evidence = [];
  const authenticatedAccount = page.getByRole("button", {
    name: "Go to the another page",
    exact: true,
  });
  await authenticatedAccount.waitFor({ state: "visible", timeout: 60000 });
  const openAuthenticatedMenu = async () => {
    if (await authenticatedAccount.getAttribute("aria-expanded") !== "true") {
      await authenticatedAccount.click();
    }
    await page.waitForFunction(() =>
      document.querySelector('button[aria-label="Go to the another page"]')?.getAttribute("aria-expanded") === "true"
    );
  };
  await openAuthenticatedMenu();
  const expectedAccountOptions = [
    "Mi cuenta",
    "Mis pedidos",
    "Wish List",
    "Mis productos",
    "Mis Cupones",
    "Mis Rewards",
    "Mis Suscripciones",
    "Cerrar sesión",
  ];
  for (const option of expectedAccountOptions) {
    await page.locator('a[role="menuitem"]', { hasText: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).first().waitFor({
      state: "attached",
      timeout: 30000,
    });
  }
  evidence.push({
    market: MARKET.toUpperCase(),
    officialTcId: "SAM-24962",
    title: "Login Home page",
    storeContext: "BS",
    s1Coverage: "full",
    preqa2ExecutionStatus: "PASS",
    runtimePath: `/${MARKET}/`,
    userType: "registered",
    evidenceSummary: "The Home header rendered the authenticated Samsung Account user and exposed Cerrar sesión.",
    automationStatus: "implemented-live-runner",
    blockerDifference: "The authenticated callback/new-tab session is now reusable by the current persistent CDP context.",
    timestamp: new Date().toISOString(),
  });
  evidence.push({
    market: MARKET.toUpperCase(),
    officialTcId: "SAM-24963",
    title: "My Account",
    storeContext: "BS",
    s1Coverage: "partial",
    preqa2ExecutionStatus: "PASS",
    runtimePath: `/${MARKET}/ -> authenticated account menu`,
    userType: "registered",
    evidenceSummary: `Authenticated menu options: ${expectedAccountOptions.join(" | ")}.`,
    automationStatus: "implemented-live-runner",
    blockerDifference: "The complete official account-menu option set is asserted without following Production targets or logging out.",
    timestamp: new Date().toISOString(),
  });
  await authenticatedAccount.click();

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
  const filtersHeading = page.getByRole("heading", { name: /^Filtros(?:\s*\(\d+\))?$/i });
  await filtersHeading.waitFor({ state: "visible", timeout: 60000 });
  const productRangeFilter = page.getByRole("button", { name: /^Gama de productos$/i });
  await productRangeFilter.waitFor({ state: "visible", timeout: 60000 });
  const resultCount = page.getByText(/\d+\s+Resultado/i).first();
  await resultCount.waitFor({ state: "visible", timeout: 60000 });
  const beforeFilterCount = await resultCount.innerText();
  const productLinks = page.locator('a[href*="/smartphones/"][href*="/buy/"]:visible');
  const beforeProductHrefs = await productLinks.evaluateAll((links) =>
    [...new Set(links.map((link) => link.href))].sort()
  );
  await productRangeFilter.click();
  const galaxyZ = page.getByRole("checkbox", { name: /^Galaxy Z$/i });
  await galaxyZ.waitFor({ state: "visible", timeout: 30000 });
  await galaxyZ.check();
  await page.waitForFunction(
    ({ previousCount, previousHrefs }) => {
      const current = [...document.querySelectorAll("body *")]
        .find((element) => /^\d+\s+Resultado(?:s)?$/i.test(element.textContent?.trim() || ""));
      const selected = [...document.querySelectorAll(".pd21-filter__selected-item")]
        .some((element) => /^Galaxy Z$/i.test(element.textContent?.trim() || ""));
      const currentHrefs = [...new Set([...document.querySelectorAll('a[href*="/smartphones/"][href*="/buy/"]')]
        .filter((link) => link.getClientRects().length > 0)
        .map((link) => link.href))].sort();
      return selected && (
        current?.textContent?.trim() !== previousCount ||
        JSON.stringify(currentHrefs) !== JSON.stringify(previousHrefs)
      );
    },
    { previousCount: beforeFilterCount, previousHrefs: beforeProductHrefs },
    { timeout: 60000 }
  ).catch(() => {});
  const afterFilterCount = await resultCount.innerText();
  const afterProductHrefs = await productLinks.evaluateAll((links) =>
    [...new Set(links.map((link) => link.href))].sort()
  );
  const filterPassed = beforeFilterCount !== afterFilterCount ||
    JSON.stringify(beforeProductHrefs) !== JSON.stringify(afterProductHrefs);
  evidence.push({
    market: MARKET.toUpperCase(),
    officialTcId: "SAM-24968",
    title: "Facets/Filter",
    storeContext: "BS",
    s1Coverage: "missing",
    preqa2ExecutionStatus: filterPassed ? "PASS" : "FAIL",
    runtimePath: `/${MARKET}/smartphones/all-smartphones/`,
    userType: "guest",
    evidenceSummary: `Gama de productos expanded and Galaxy Z was selected. Result count: ${beforeFilterCount} -> ${afterFilterCount}; visible product targets: ${beforeProductHrefs.length} -> ${afterProductHrefs.length}.`,
    automationStatus: "implemented-live-runner",
    blockerDifference: filterPassed ? "" : "The selected facet did not produce an observable product-result change.",
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
  await page.goto(`https://${PREQA2_HOST}/${MARKET}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
}

main().catch((error) => {
  console.error(`[preqa2-safe] ${error.message}`);
  process.exitCode = 1;
});
