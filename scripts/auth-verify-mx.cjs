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
  };

  // Local auth verification intentionally uses installed Chrome because the
  // human bootstrap/login is completed there. Jenkins must validate with the
  // same bundled Chromium/headless runtime used by the actual Playwright QSTs;
  // forcing headed Chrome from a Windows service can produce a false auth
  // failure even when the credential is reusable by the test runtime.
  if (!ci) launchOptions.channel = "chrome";

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
    console.log(`[auth:verify:mx] runtime: ${ci ? "CI bundled Chromium" : "local Chrome"} | ${headless ? "headless" : "headed"}`);

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
