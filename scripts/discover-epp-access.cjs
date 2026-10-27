const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { getEppConfig } = require("../config/markets/epp");
const { classifyEppAccess } = require("../utils/eppAccessState.cjs");

// Read-only discovery: no identity import, code/email submission, or cart mutation.
async function discover() {
  const output = path.resolve("test-results/epp-discovery", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    for (const market of ["MX", "CO", "PE", "CL"]) for (const environment of ["S1", "S2"]) {
      const cfg = getEppConfig(market, { ENVIRONMENT: environment });
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      let blockedRedirect = false;
      await page.route("**/*", route => {
        const request = route.request();
        if (request.isNavigationRequest() && request.frame() === page.mainFrame() && new URL(request.url()).origin !== cfg.rootUrl.origin) {
          blockedRedirect = true;
          return route.abort();
        }
        return route.continue();
      });
      let result = { market, environment, status: "BLOCKED", reason: "ACCESS_NOT_OBSERVED" };
      try {
        // Stage bootstrap is explicit; discovery never substitutes Production.
        await page.goto(new URL("/getcookie.html", cfg.rootUrl).href, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.getByText(/You can access pages now/i).first().waitFor({ state: "visible", timeout: 15000 });
        const response = await page.goto(cfg.entryUrl.href, { waitUntil: "domcontentloaded", timeout: 45000 });
        const deadline = Date.now() + 45000;
        do {
          try {
            const dom = await page.evaluate(() => {
              const visible = e => !!(e.getBoundingClientRect().width && e.getBoundingClientRect().height);
              return {
                body: document.body?.innerText || "",
                corporateEmailVisible: [...document.querySelectorAll('input[type="email"]')].some(visible),
                codeVisible: [...document.querySelectorAll("input")].some(e => visible(e) && /verification|access code|c[oó]digo|clave de acceso/i.test(`${e.placeholder} ${e.getAttribute("aria-label") || ""} ${[...(e.labels || [])].map(label => label.textContent).join(" ")}`)),
                commerceVisible: [...document.querySelectorAll('.product-card,.product-detail,.product-details,.pdp,[data-component="product-card"]')].some(visible),
              };
            });
            const state = classifyEppAccess({ url: page.url(), rootUrl: cfg.rootUrl.href, ...dom });
            result = { market, environment, ...state, httpStatus: response?.status() ?? null, observedAt: new Date().toISOString() };
            if (["READY", "HUMAN_REQUIRED", "CODE_REQUIRED"].includes(state.status)) break;
          } catch (error) {
            if (!/Execution context was destroyed/.test(error.message)) throw error;
          }
          await page.waitForTimeout(500);
        } while (Date.now() < deadline);
      } catch (error) {
        // Raw Playwright errors can include URLs, form values or call logs.
        result = { market, environment, status: "BLOCKED", reason: blockedRedirect ? "UNAPPROVED_REDIRECT" : error.name === "TimeoutError" ? "NAVIGATION_TIMEOUT" : "NAVIGATION_FAILED", observedAt: new Date().toISOString() };
      } finally { await context.close(); }
      results.push(result);
      fs.writeFileSync(path.join(output, "access.json"), JSON.stringify(results, null, 2));
      console.log(`[epp-discovery] ${market} ${environment} ${result.status} ${result.reason}`);
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, "tc-matrix.json"), JSON.stringify(buildMatrix(results), null, 2));
  console.log(`[epp-discovery] Safe inventory: ${output}`);
  return results;
}

function buildMatrix(results) {
  const matrix = [];
  for (const access of results) {
    const directory = path.resolve(__dirname, "..", "tests", "markets", access.market.toLowerCase(), "qst", "epp");
    for (const file of fs.readdirSync(directory).filter(name => name.endsWith(".spec.js"))) {
      const source = fs.readFileSync(path.join(directory, file), "utf8");
      for (const match of source.matchAll(/test\("(SAM-\d+)([^"\n]*)/g)) {
        matrix.push({ market: access.market, environment: access.environment, tc: match[1],
          implementation: /@blocked/.test(match[2]) ? "PREREQUISITE_PLACEHOLDER" : "PARTIAL_REQUIRES_FUNCTIONAL_REVIEW",
          runtime: "NOT_RUN", result: "NOT_RUN", access: access.status, notes: access.reason });
      }
    }
  }
  return matrix;
}
if (require.main === module) discover().catch(() => { console.error("[epp-discovery] Discovery failed; no session data printed."); process.exitCode = 1; });
module.exports = { discover, buildMatrix };
