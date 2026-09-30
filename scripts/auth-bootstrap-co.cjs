const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { getCoQstConfig } = require("../config/markets/co");

const config = getCoQstConfig();
const envSuffix = config.environment.toLowerCase();
const HOSTNAME = config.baseUrl.hostname;
const profileDir = path.resolve(`playwright/profiles/${envSuffix}-co-qa`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `co-${envSuffix}-user.json`);
const authTempFile = `${authFile}.tmp`;
const sessionStorageFile = path.join(authDir, `co-${envSuffix}-session-storage.json`);
const sessionStorageTempFile = `${sessionStorageFile}.tmp`;
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");

let currentStep = `starting ${config.environment} CO export`;

function reportStep(message) {
  currentStep = message;
  console.log(`[auth:export:co] ${message}`);
}

function safeErrorSummary(error) {
  return String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
}

function assertCoHostAndRoute(page, step) {
  const url = new URL(page.url());
  if (url.hostname !== HOSTNAME) throw new Error(`${step} left the configured ${config.environment} CO host`);
  if (step === "storefront navigation" && !url.pathname.toLowerCase().startsWith("/co/")) {
    throw new Error(`${step} left the CO storefront route`);
  }
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) {
    throw new Error(`the dedicated ${config.environment} CO Chrome is not available; run CO_QST_ENVIRONMENT=${config.environment} npm run auth:open-profile:co`);
  }
  const [portText] = fs.readFileSync(devToolsActivePortFile, "utf8").split("\n");
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`the dedicated ${config.environment} CO Chrome debugging endpoint is invalid`);
  }
  return port;
}

async function openAuthenticatedProfileMenu(page) {
  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  await page.keyboard.press("Escape");
  await profileButton.click();
  const logout = page.getByText(/Cerrar sesi[oó]n/i, { exact: true }).filter({ visible: true });
  await logout.waitFor({ state: "visible", timeout: 30000 });
  reportStep("authenticated profile action is visible");
}

function writeJsonAtomically(tempFile, destination, value) {
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(tempFile, 0o600);
  fs.renameSync(tempFile, destination);
}

async function exportCoAuthentication() {
  fs.mkdirSync(authDir, { recursive: true });
  reportStep(`connecting to the live dedicated ${config.environment} CO Chrome`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${readDevToolsPort()}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error(`the dedicated ${config.environment} CO Chrome did not expose its browser context`);
  const page = await context.newPage();

  try {
    if (config.setupUrl) {
      reportStep(`opening configured ${config.environment} CO storefront setup`);
      await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded" });
      assertCoHostAndRoute(page, "storefront setup");
    }

    reportStep(`opening ${config.environment} CO storefront`);
    await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded" });
    assertCoHostAndRoute(page, "storefront navigation");
    await openAuthenticatedProfileMenu(page);

    reportStep(`collecting filtered ${config.environment} CO storage state`);
    const fullState = await context.storageState({ indexedDB: true });
    const coState = {
      cookies: fullState.cookies.filter((cookie) => {
        const domain = cookie.domain.replace(/^\./, "");
        return domain === HOSTNAME || cookie.domain === ".samsung.com";
      }),
      origins: fullState.origins.filter(({ origin }) => new URL(origin).hostname === HOSTNAME),
    };
    if (!coState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
      throw new Error(`No configured ${config.environment} CO storefront cookies were available for export`);
    }

    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );

    writeJsonAtomically(authTempFile, authFile, coState);
    writeJsonAtomically(sessionStorageTempFile, sessionStorageFile, sessionStorage);
    reportStep(`${config.environment} CO auth state exported to dedicated ignored artifacts`);
  } finally {
    for (const tempFile of [authTempFile, sessionStorageTempFile]) {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
    await browser.close();
  }
}

exportCoAuthentication().catch((error) => {
  console.error(`[auth:export:co] failed while ${currentStep}: ${error.name}: ${safeErrorSummary(error)}`);
  console.error("[auth:export:co] existing CO auth artifacts, if any, were preserved");
  process.exitCode = 1;
});
