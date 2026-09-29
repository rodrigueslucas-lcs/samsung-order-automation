const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const { resolveMxEnvironment } = require("../utils/mxConfig");
const target = resolveMxEnvironment();
const {
  AUTH_SESSION_STORAGE_PATH,
  applyAuthSessionStorage,
  markAuthStateVerified,
  requireAuthState,
  validateAuthenticatedSession,
} = require("../utils/mxAuthState");

function writeJsonSecurely(destination, value) {
  writeJsonAtomically(destination, value);
}

async function verifyMxAuthentication() {
  const ci = ["1", "true"].includes(String(process.env.CI || "").toLowerCase());
  const headless = ci || process.env.MX_QST_HEADLESS === "1";
  const launchOptions = {
    headless,
    args: headless ? [] : ["--start-maximized"],
    channel: "chrome",
  };

  // The QST runtime uses the installed Chrome channel unless video capture is
  // enabled. Verify the transported session in that same browser family so the
  // readiness gate does not reject a valid Chrome session only because bundled
  // Chromium has different Samsung session behavior.

  const browser = await chromium.launch(launchOptions);

  try {
    const context = await browser.newContext({
      storageState: requireAuthState(),
      viewport: headless ? { width: 1440, height: 900 } : null,
    });
    await applyAuthSessionStorage(context);
    const page = await context.newPage();

    console.log(`[auth:verify:mx] fresh ${target.name} MX browser context created`);
    console.log(`[auth:verify:mx] target: ${target.name} | MX | ${target.hostname}`);
    console.log(`[auth:verify:mx] runtime: ${ci ? "CI Chrome" : "local Chrome"} | ${headless ? "headless" : "headed"}`);

    try {
      await validateAuthenticatedSession(page);
    } catch (error) {
      let safeUrl = "unavailable";
      let safeTitle = "unavailable";
      try {
        const current = new URL(page.url());
        safeUrl = `${current.origin}${current.pathname}`;
      } catch {}
      try { safeTitle = (await page.title()).slice(0, 120); } catch {}
      console.error(`[auth:verify:mx] diagnostic url: ${safeUrl}`);
      console.error(`[auth:verify:mx] diagnostic title: ${safeTitle}`);
      throw error;
    }

    console.log(`[auth:verify:mx] Cerrar sesión validated in a fresh ${target.name} MX context`);
    await context.storageState({ path: requireAuthState(), indexedDB: true });
    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );
    writeJsonSecurely(AUTH_SESSION_STORAGE_PATH, sessionStorage);
    markAuthStateVerified();
    console.log("[auth:verify:mx] refreshed MX session state preserved and marked as verified for the target environment");
  } finally {
    await browser.close();
  }
}

verifyMxAuthentication().catch((error) => {
  const summary = String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:verify:mx] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
