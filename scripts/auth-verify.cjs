const { chromium } = require("@playwright/test");
const {
  applyAuthSessionStorage,
  requireAuthState,
  validateAuthenticatedSession,
} = require("../utils/authState");

async function verifyAuthentication() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
  });

  try {
    const context = await browser.newContext({
      storageState: requireAuthState(),
    });
    await applyAuthSessionStorage(context);
    const page = await context.newPage();

    console.log("[auth:verify] fresh browser context created");
    console.log("[auth:verify] validating the saved ST2 session");
    await validateAuthenticatedSession(page);

    console.log("[auth:verify] fresh context loaded the saved ST2 state");
    console.log("[auth:verify] Cerrar sesión validated");
  } finally {
    await browser.close();
  }
}

verifyAuthentication().catch((error) => {
  const summary = String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:verify] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
