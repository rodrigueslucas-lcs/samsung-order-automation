const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const {
  PE_AUTH_SESSION_STORAGE_PATH,
  getPeAuthState,
} = require("../utils/peAuthState");
const { getPeS1QstConfig } = require("../config/markets/pe");

function writeJsonSecurely(destination, value) {
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, destination);
}

async function verifyPeAuthentication() {
  const config = getPeS1QstConfig();
  const auth = getPeAuthState();
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--start-maximized"],
  });

  try {
    const context = await browser.newContext({
      storageState: auth.requireAuthState(),
      viewport: null,
    });
    await auth.applyAuthSessionStorage(context);
    const page = await context.newPage();

    console.log("[auth:verify:pe] fresh S1 PE browser context created");
    console.log(`[auth:verify:pe] target: S1 | PE | ${config.baseUrl.hostname}`);
    await auth.validateAuthenticatedSession(page);
    console.log("[auth:verify:pe] authenticated profile action validated in a fresh S1 PE context");

    await context.storageState({ path: auth.requireAuthState(), indexedDB: true });
    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );
    writeJsonSecurely(PE_AUTH_SESSION_STORAGE_PATH, sessionStorage);
    console.log("[auth:verify:pe] refreshed PE session state preserved for the test fixture");
  } finally {
    await browser.close();
  }
}

verifyPeAuthentication().catch((error) => {
  const summary = String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:verify:pe] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
