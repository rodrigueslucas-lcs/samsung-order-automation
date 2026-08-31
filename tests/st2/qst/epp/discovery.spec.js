import { expect, test } from "@playwright/test";
import authState from "../../../../utils/authState";
import { annotateQstExecution } from "../../../../utils/qstExecutionSummary";

const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  validateAuthenticatedSession,
} = authState;

const STAGING_ORIGIN = "https://stg2.shop.samsung.com";
const EPP_CANDIDATE_PATH = "/pe/campaign/select-ai";
const OFFICIAL_EPP_PATH_CANDIDATES = [
  "/pe/multistore/beneficios_empleados/",
  "/pe/multistore/ventaempleados/",
];

test.describe("QST EPP - safe staging discovery", () => {
  test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!hasAuthState(), "Authenticated ST2 state required. Run auth bootstrap first.");
    await applyAuthSessionStorage(context);
  });

  test("EPP-DISCOVERY @qst @epp - inspect authenticated staging candidates", async ({ page }, testInfo) => {
    test.setTimeout(180000);
    annotateQstExecution(testInfo, {
      type: process.env.QST_TYPE,
      storeType: "EPP",
    });

    const responses = [];
    const failures = [];
    const consoleErrors = [];
    page.on("response", (entry) => {
      const url = new URL(entry.url());
      if (entry.status() >= 400 || /campaign|epp|employee|benefit|cms|page/i.test(url.pathname)) {
        responses.push({
          method: entry.request().method(),
          status: entry.status(),
          origin: url.origin,
          path: url.pathname,
        });
      }
    });
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      failures.push({
        method: request.method(),
        origin: url.origin,
        path: url.pathname,
        error: request.failure()?.errorText || "unknown",
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
    });

    await validateAuthenticatedSession(page);
    const homepageCandidates = await page.locator("a[href]").evaluateAll((links) =>
      links
        .map((link) => ({
          text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
          href: link.href,
        }))
        .filter(({ text, href }) => /epp|employee|emplead|benefit|beneficio|campaign|campana|oferta especial/i.test(`${text} ${href}`))
        .map(({ text, href }) => {
          const url = new URL(href, window.location.origin);
          return { text, origin: url.origin, path: url.pathname };
        })
        .slice(0, 50)
    );

    const response = await page.goto(`${STAGING_ORIGIN}${EPP_CANDIDATE_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    const finalUrl = new URL(page.url());
    expect(finalUrl.hostname).toBe("stg2.shop.samsung.com");
    const evidence = {
      candidatePath: EPP_CANDIDATE_PATH,
      documentStatus: response?.status() ?? null,
      finalOrigin: finalUrl.origin,
      finalPath: finalUrl.pathname,
      title: await page.title(),
      headings: (await page.getByRole("heading").allInnerTexts()).slice(0, 20),
      bodyPreview: (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 500),
      homepageCandidates,
      scriptPaths: await page.locator("script[src]").evaluateAll((scripts) =>
        scripts.slice(0, 30).map((script) => {
          const url = new URL(script.src, window.location.origin);
          return { origin: url.origin, path: url.pathname };
        })
      ),
      responses: responses.slice(-60),
      failures: failures.slice(-30),
      consoleErrors: consoleErrors.slice(-30),
    };

    console.log(`[epp-discovery] ${JSON.stringify(evidence)}`);
    await testInfo.attach("epp-discovery", {
      body: Buffer.from(JSON.stringify(evidence, null, 2)),
      contentType: "application/json",
    });
  });

  for (const path of OFFICIAL_EPP_PATH_CANDIDATES) {
    test(`EPP-DISCOVERY @qst @epp - validate staging candidate ${path}`, async ({ page }, testInfo) => {
      test.setTimeout(120000);
      annotateQstExecution(testInfo, {
        type: process.env.QST_TYPE,
        storeType: "EPP",
      });

      const blockedProduction = [];
      await page.route("https://www.samsung.com/**", async (route) => {
        const url = new URL(route.request().url());
        blockedProduction.push({ origin: url.origin, path: url.pathname });
        await route.abort("blockedbyclient");
      });

      await validateAuthenticatedSession(page);
      const response = await page
        .goto(`${STAGING_ORIGIN}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        })
        .catch(() => null);
      await page.waitForTimeout(5000);
      const finalUrl = new URL(page.url());
      const evidence = {
        requestedPath: path,
        documentStatus: response?.status() ?? null,
        finalOrigin: finalUrl.origin,
        finalPath: finalUrl.pathname,
        blockedProduction,
        isUsableStagingRoute:
          finalUrl.hostname === "stg2.shop.samsung.com" && blockedProduction.length === 0,
      };

      console.log(`[epp-route] ${JSON.stringify(evidence)}`);
      await testInfo.attach("epp-route", {
        body: Buffer.from(JSON.stringify(evidence, null, 2)),
        contentType: "application/json",
      });
    });
  }
});
