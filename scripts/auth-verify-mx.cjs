const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const {
  AUTH_SESSION_STORAGE_PATH,
  applyAuthSessionStorage,
  requireAuthState,
  validateAuthenticatedSession,
} = require("../utils/mxAuthState");

function writeJsonSecurely(destination, value) {
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, destination);
}

async function verifyMxAuthentication() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--start-maximized"],
  });

  try {
    const context = await browser.newContext({
      storageState: requireAuthState(),
      viewport: null,
    });
    await applyAuthSessionStorage(context);
    const page = await context.newPage();

    console.log("[auth:verify:mx] fresh S1 MX browser context created");
    console.log("[auth:verify:mx] target: S1 | MX | stg.shop.samsung.com");
    await validateAuthenticatedSession(page);
    console.log("[auth:verify:mx] Cerrar sesión validated in a fresh S1 MX context");
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
    console.log("[auth:verify:mx] refreshed MX session state preserved for the test fixture");
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
