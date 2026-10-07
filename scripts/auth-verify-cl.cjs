const { chromium } = require("@playwright/test");
const { writeJsonAtomically } = require("../utils/atomicJson");
const {
  CL_AUTH_SESSION_STORAGE_PATH,
  getClAuthState,
  markClAuthStateVerified,
} = require("../utils/clAuthState");
const { getClQstConfig } = require("../config/markets/cl");

async function verifyClAuthentication() {
  const config = getClQstConfig();
  const auth = getClAuthState();
  const ci = ["1", "true"].includes(String(process.env.CI || "").toLowerCase());
  const browser = await chromium.launch({
    channel: "chrome",
    headless: ci,
    args: ci ? [] : ["--start-maximized"],
  });
  try {
    const context = await browser.newContext({
      storageState: auth.requireAuthState(),
      viewport: ci ? { width: 1440, height: 900 } : null,
    });
    await auth.applyAuthSessionStorage(context);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(ci ? 120000 : 60000);
    page.setDefaultTimeout(ci ? 90000 : 60000);
    console.log(`[auth:verify:cl] validating ${config.environment} CL authenticated session`);
    await auth.validateAuthenticatedSession(page);
    await context.storageState({ path: auth.requireAuthState(), indexedDB: true });
    const sessionStorage = await page.evaluate(() => Object.fromEntries(
      Array.from({ length: window.sessionStorage.length }, (_, index) => {
        const key = window.sessionStorage.key(index);
        return [key, key === null ? null : window.sessionStorage.getItem(key)];
      }).filter(([key]) => key !== null)
    ));
    writeJsonAtomically(CL_AUTH_SESSION_STORAGE_PATH, sessionStorage);
    markClAuthStateVerified();
    console.log(`[auth:verify:cl] READY · CL ${config.environment} authenticated state verified and persisted.`);
  } finally {
    await browser.close();
  }
}

verifyClAuthentication().catch((error) => {
  console.error(`[auth:verify:cl] ${error.name}: ${String(error.message || error).split("\n", 1)[0]}`);
  process.exitCode = 1;
});
