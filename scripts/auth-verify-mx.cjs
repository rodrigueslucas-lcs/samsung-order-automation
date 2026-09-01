const { chromium } = require("@playwright/test");
const {
  applyAuthSessionStorage,
  requireAuthState,
  validateAuthenticatedSession,
} = require("../utils/mxAuthState");

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
