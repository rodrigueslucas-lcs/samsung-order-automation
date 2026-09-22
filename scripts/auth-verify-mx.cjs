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

    console.log(`[auth:verify:mx] fresh ${target.name} MX browser context created`);
    console.log(`[auth:verify:mx] target: ${target.name} | MX | ${target.hostname}`);
    await validateAuthenticatedSession(page);
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
