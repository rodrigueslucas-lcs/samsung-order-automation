const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const HOSTNAME = "stg.shop.samsung.com";
const setupUrl = `https://${HOSTNAME}/getcookie.html`;
const homeUrl = `https://${HOSTNAME}/mx/`;
const profileDir = path.resolve("playwright/profiles/s1-mx-qa");
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, "mx-s1-user.json");
const authTempFile = `${authFile}.tmp`;
const sessionStorageFile = path.join(authDir, "mx-s1-session-storage.json");
const sessionStorageTempFile = `${sessionStorageFile}.tmp`;
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");

let currentStep = "starting S1 MX export";

function reportStep(message) {
  currentStep = message;
  console.log(`[auth:export:mx] ${message}`);
}

function safeErrorSummary(error) {
  return String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
}

function assertMxHost(page, step) {
  if (new URL(page.url()).hostname !== HOSTNAME) {
    throw new Error(`${step} left the allowed S1 MX host`);
  }
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) {
    throw new Error(
      "the dedicated S1 MX Chrome is not available; run npm run auth:open-profile:mx"
    );
  }
  const [portText] = fs.readFileSync(devToolsActivePortFile, "utf8").split("\n");
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("the dedicated S1 MX Chrome debugging endpoint is invalid");
  }
  return port;
}

async function openAuthenticatedProfileMenu(page) {
  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  reportStep("My Profile is visible");
  await profileButton.hover();

  const logout = page
    .getByRole("link", { name: /^Cerrar Sesi[oó]n$/i })
    .filter({ visible: true });
  if (!(await logout.isVisible().catch(() => false))) {
    await profileButton.click();
  }
  await logout.waitFor({ state: "visible", timeout: 30000 }).catch(() => {
    throw new Error(
      "the S1 MX profile menu is signed out; complete the manual login and keep Chrome open"
    );
  });
  reportStep("authenticated profile menu is open and Cerrar sesión is visible");
}

function writeJsonAtomically(tempFile, destination, value) {
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(tempFile, 0o600);
  fs.renameSync(tempFile, destination);
}

async function exportMxAuthentication() {
  fs.mkdirSync(authDir, { recursive: true });
  reportStep("connecting to the live dedicated S1 MX Chrome");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${readDevToolsPort()}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("the dedicated S1 MX Chrome did not expose its browser context");
  const page = await context.newPage();

  try {
    reportStep("opening S1 MX cookie setup");
    await page.goto(setupUrl, { waitUntil: "domcontentloaded" });
    assertMxHost(page, "cookie setup");
    await page.getByText(/You can access pages now/i).waitFor({ state: "visible", timeout: 60000 });

    reportStep("opening S1 MX storefront");
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
    assertMxHost(page, "storefront navigation");
    await openAuthenticatedProfileMenu(page);

    reportStep("collecting filtered S1 MX storage state");
    const fullState = await context.storageState({ indexedDB: true });
    const mxState = {
      cookies: fullState.cookies.filter((cookie) => {
        const domain = cookie.domain.replace(/^\./, "");
        return domain === HOSTNAME || cookie.domain === ".samsung.com";
      }),
      origins: fullState.origins.filter(
        ({ origin }) => new URL(origin).hostname === HOSTNAME
      ),
    };
    if (!mxState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
      throw new Error("No S1 MX storefront cookies were available for export");
    }

    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );

    writeJsonAtomically(authTempFile, authFile, mxState);
    writeJsonAtomically(sessionStorageTempFile, sessionStorageFile, sessionStorage);
    reportStep("S1 MX auth state exported to dedicated ignored artifacts");
    console.log(
      "[auth:export:mx] S1 MX storefront and required parent-domain state exported; identity-provider and third-party state excluded"
    );
  } finally {
    for (const tempFile of [authTempFile, sessionStorageTempFile]) {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
    await browser.close();
  }
}

exportMxAuthentication().catch((error) => {
  console.error(
    `[auth:export:mx] failed while ${currentStep}: ${error.name}: ${safeErrorSummary(error)}`
  );
  console.error("[auth:export:mx] existing MX auth artifacts, if any, were preserved");
  process.exitCode = 1;
});
