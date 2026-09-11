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
    const url = new URL(candidate.url());
    if (!url.pathname.startsWith(`/${MARKET}/`)) continue;

    const bodyText = await candidate.locator("body").innerText().catch(() => "");
    if (!/Please login through WMC/i.test(bodyText)) {
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
    const item = page
      .getByText(option, { exact: true })
      .filter({ visible: true })
      .first();

    await item.waitFor({
      state: "visible",
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

  // SAM-24968 must start from a clean, unfiltered PLP.
  await page.goto(
    `https://${PREQA2_HOST}/${MARKET}/smartphones/all-smartphones/`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  requirePreqa(page);
  await page.waitForURL((url) =>
    url.hostname === PREQA2_HOST &&
    url.pathname === `/${MARKET}/smartphones/all-smartphones/` &&
    url.search === "",
  { timeout: 60000 });

  const filtersHeading = page.getByRole("heading", { name: /^Filtros(?:\s*\(\d+\))?$/i });
  await filtersHeading.waitFor({ state: "visible", timeout: 60000 });
  const productRangeFilter = page.getByRole("button", { name: /^Gama de productos$/i });
  await productRangeFilter.waitFor({ state: "visible", timeout: 60000 });
  const productLinks = page.locator('a[href*="/smartphones/"][href*="/buy/"]:visible');

  const resultCount = page
    .getByText(/^\d+\s+Resultado(?:s)?$/i)
    .filter({ visible: true })
    .first();

  await resultCount.waitFor({ state: "visible", timeout: 60000 });

  const beforeFilterText = await resultCount.innerText();
  const beforeFilterCount = Number(beforeFilterText.match(/\d+/)?.[0]);

  assert.ok(
    Number.isFinite(beforeFilterCount),
    `SAM-24968 could not read the unfiltered result count from "${beforeFilterText}"`
  );

  await productRangeFilter.click();

  const galaxyZ = page.getByRole("checkbox", { name: /^Galaxy Z$/i });
  await galaxyZ.waitFor({ state: "visible", timeout: 30000 });

  assert.equal(
    await galaxyZ.isChecked(),
    false,
    "SAM-24968 must start with Galaxy Z unselected"
  );

  const beforeProductHrefs = await productLinks.evaluateAll((links) =>
    [...new Set(links.map((link) => link.href))].sort()
  );

  await Promise.all([
    page.waitForURL(
      (url) =>
        url.hostname === PREQA2_HOST &&
        url.search.toLowerCase().includes("galaxy-z"),
      { timeout: 60000 }
    ),
    galaxyZ.check(),
  ]);

  await page.waitForFunction(
    ({ previousCount }) => {
      const candidates = [...document.querySelectorAll("body *")];

      return candidates.some((element) => {
        if (element.getClientRects().length === 0) return false;

        const text = element.textContent?.trim() || "";
        const match = text.match(/^(\d+)\s+Resultado(?:s)?$/i);

        return match && Number(match[1]) !== previousCount;
      });
    },
    { previousCount: beforeFilterCount },
    { timeout: 60000 }
  );

  const afterFilterText = await resultCount.innerText();
  const afterFilterCount = Number(afterFilterText.match(/\d+/)?.[0]);

  assert.ok(
    Number.isFinite(afterFilterCount),
    `SAM-24968 could not read the filtered result count from "${afterFilterText}"`
  );

  const galaxyZAfterRender = page.getByRole("checkbox", { name: /^Galaxy Z$/i });
  await galaxyZAfterRender.waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await galaxyZAfterRender.isChecked(), true, "Galaxy Z checkbox did not remain selected after PLP update");
  await page.waitForFunction(() => [...document.querySelectorAll("body *")].some((element) =>
    element.getClientRects().length > 0 &&
    /^Galaxy Z$/i.test(element.textContent?.trim() || "") &&
    !element.closest("label")
  ), undefined, { timeout: 60000 });

  const afterProductHrefs = await productLinks.evaluateAll((links) =>
    [...new Set(links.map((link) => link.href))].sort()
  );

  const filterPassed =
    await galaxyZAfterRender.isChecked() &&
    page.url().includes("galaxy-z") &&
    afterFilterCount < beforeFilterCount;

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
