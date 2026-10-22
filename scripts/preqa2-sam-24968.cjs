const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { PREQA2_HOST } = require("../utils/preqa2Config");

const CDP_URL = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";
const MARKET = String(process.env.PREQA2_MARKET || "mx").toLowerCase();

function requirePreqa(page) {
  const url = new URL(page.url());
  assert.equal(url.hostname, PREQA2_HOST, `Navigation left PreQA2: ${page.url()}`);
  assert.match(url.pathname, new RegExp(`^/${MARKET}(?:/|$)`, "i"));
}

async function main() {
  console.log(`[SAM-24968] Connecting to PreQA2 Chrome via ${CDP_URL}`);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  assert.ok(context, "No browser context found in the attached Chrome.");

  const preqaPages = [...context.pages()].reverse().filter((candidate) => {
    try {
      return new URL(candidate.url()).hostname === PREQA2_HOST;
    } catch {
      return false;
    }
  });

  let page = null;
  for (const candidate of preqaPages) {
    const url = new URL(candidate.url());
    if (!url.pathname.startsWith(`/${MARKET}/`)) continue;

    const bodyText = await candidate.locator("body").innerText().catch(() => "");
    if (!/Please login through WMC/i.test(bodyText)) {
      page = candidate;
      break;
    }
  }

  assert.ok(page, "An authenticated PreQA2 page is required in the attached Chrome.");
  await page.bringToFront();
  requirePreqa(page);

  console.log(`[SAM-24968] Opening clean Facets/Filter PLP for ${MARKET.toUpperCase()}...`);

  await page.goto(
    `https://${PREQA2_HOST}/${MARKET}/smartphones/all-smartphones/`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );

  requirePreqa(page);

  await page.waitForURL(
    (url) =>
      url.hostname === PREQA2_HOST &&
      url.pathname === `/${MARKET}/smartphones/all-smartphones/` &&
      url.search === "",
    { timeout: 60000 }
  );

  const filtersHeading = page.getByRole("heading", { name: /^Filtros(?:\s*\(\d+\))?$/i });
  await filtersHeading.waitFor({ state: "visible", timeout: 60000 });

  const productRangeFilter = page.getByRole("button", { name: /^Gama de productos$/i });
  await productRangeFilter.waitFor({ state: "visible", timeout: 60000 });

  const resultCount = page
    .getByText(/^\d+\s+Resultado(?:s)?$/i)
    .filter({ visible: true })
    .first();

  await resultCount.waitFor({ state: "visible", timeout: 60000 });

  const beforeText = await resultCount.innerText();
  const beforeCount = Number(beforeText.match(/\d+/)?.[0]);
  assert.ok(Number.isFinite(beforeCount), `Could not read initial result count from "${beforeText}"`);

  console.log(`[SAM-24968] Initial result count: ${beforeCount}`);
  console.log("[SAM-24968] Expanding Gama de productos...");
  await productRangeFilter.click();

  const galaxyZ = page.getByRole("checkbox", { name: /^Galaxy Z$/i });
  await galaxyZ.waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await galaxyZ.isChecked(), false, "Galaxy Z must start unselected.");

  console.log("[SAM-24968] Selecting Galaxy Z...");

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
    { previousCount: beforeCount },
    { timeout: 60000 }
  );

  const afterText = await resultCount.innerText();
  const afterCount = Number(afterText.match(/\d+/)?.[0]);
  assert.ok(Number.isFinite(afterCount), `Could not read filtered result count from "${afterText}"`);

  const galaxyZAfterRender = page.getByRole("checkbox", { name: /^Galaxy Z$/i });
  await galaxyZAfterRender.waitFor({ state: "visible", timeout: 60000 });

  const checked = await galaxyZAfterRender.isChecked();
  const hasFilterInUrl = page.url().toLowerCase().includes("galaxy-z");
  const countChanged = afterCount < beforeCount;

  console.log(`[SAM-24968] Filtered result count: ${afterCount}`);
  console.log(`[SAM-24968] Galaxy Z selected: ${checked}`);
  console.log(`[SAM-24968] URL contains galaxy-z: ${hasFilterInUrl}`);
  console.log(`[SAM-24968] Result count changed: ${beforeCount} -> ${afterCount}`);

  assert.equal(checked, true, "Galaxy Z checkbox did not remain selected after PLP update.");
  assert.equal(hasFilterInUrl, true, "Filtered URL does not contain galaxy-z.");
  assert.equal(countChanged, true, `Result count did not decrease: ${beforeCount} -> ${afterCount}`);

  console.log(`\n[SAM-24968] PASS - Facets/Filter validated successfully in PreQA2 (${beforeCount} -> ${afterCount}).`);
}

main().catch((error) => {
  console.error(`\n[SAM-24968] FAIL - ${error.message}`);
  process.exitCode = 1;
});
