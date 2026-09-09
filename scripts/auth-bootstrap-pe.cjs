const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { getPeS1QstConfig } = require("../config/markets/pe");

const config = getPeS1QstConfig();
const HOSTNAME = config.baseUrl.hostname;
const profileDir = path.resolve("playwright/profiles/s1-pe-qa");
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, "pe-s1-user.json");
const authTempFile = `${authFile}.tmp`;
const sessionStorageFile = path.join(authDir, "pe-s1-session-storage.json");
const sessionStorageTempFile = `${sessionStorageFile}.tmp`;
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");

let currentStep = "starting S1 PE export";

function reportStep(message) {
  currentStep = message;
  console.log(`[auth:export:pe] ${message}`);
}

function safeErrorSummary(error) {
  return String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
}

function assertPeHostAndRoute(page, step) {
  const url = new URL(page.url());
  if (url.hostname !== HOSTNAME) {
    throw new Error(`${step} left the configured S1 PE host`);
  }
  if (step === "storefront navigation" && !url.pathname.toLowerCase().startsWith("/pe/")) {
    throw new Error(`${step} left the PE storefront route`);
  }
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) {
    throw new Error(
      "the dedicated S1 PE Chrome is not available; run npm run auth:open-profile:pe"
    );
  }
  const [portText] = fs.readFileSync(devToolsActivePortFile, "utf8").split("\n");
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("the dedicated S1 PE Chrome debugging endpoint is invalid");
  }
  return port;
}

async function openAuthenticatedProfileMenu(page) {
  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  await page.keyboard.press("Escape");
  await profileButton.click();

  const logout = page
    .getByText(/Cerrar sesi[oó]n/i, { exact: true })
    .filter({ visible: true });
  await logout.waitFor({ state: "visible", timeout: 30000 });
  reportStep("authenticated profile action is visible");
}

function writeJsonAtomically(tempFile, destination, value) {
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(tempFile, 0o600);
  fs.renameSync(tempFile, destination);
}

async function exportPeAuthentication() {
  fs.mkdirSync(authDir, { recursive: true });
  reportStep("connecting to the live dedicated S1 PE Chrome");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${readDevToolsPort()}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("the dedicated S1 PE Chrome did not expose its browser context");
  const page = await context.newPage();

  try {
    if (config.setupUrl) {
      reportStep("opening configured S1 PE storefront setup");
      await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded" });
      assertPeHostAndRoute(page, "storefront setup");
    }

    reportStep("opening S1 PE storefront");
    await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded" });
    assertPeHostAndRoute(page, "storefront navigation");
    await openAuthenticatedProfileMenu(page);

    reportStep("collecting filtered S1 PE storage state");
    const fullState = await context.storageState({ indexedDB: true });
    const peState = {
      cookies: fullState.cookies.filter((cookie) => {
        const domain = cookie.domain.replace(/^\./, "");
        return domain === HOSTNAME || cookie.domain === ".samsung.com";
      }),
      origins: fullState.origins.filter(
        ({ origin }) => new URL(origin).hostname === HOSTNAME
      ),
    };
    if (!peState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
      throw new Error("No configured S1 PE storefront cookies were available for export");
    }

    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );

    writeJsonAtomically(authTempFile, authFile, peState);
    writeJsonAtomically(sessionStorageTempFile, sessionStorageFile, sessionStorage);
    reportStep("S1 PE auth state exported to dedicated ignored artifacts");
  } finally {
    for (const tempFile of [authTempFile, sessionStorageTempFile]) {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
    await browser.close();
  }
}

exportPeAuthentication().catch((error) => {
  console.error(
    `[auth:export:pe] failed while ${currentStep}: ${error.name}: ${safeErrorSummary(error)}`
  );
  console.error("[auth:export:pe] existing PE auth artifacts, if any, were preserved");
  process.exitCode = 1;
});
