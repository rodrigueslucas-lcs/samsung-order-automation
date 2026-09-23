const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { resolveMxEnvironment } = require("../utils/mxConfig");

const target = resolveMxEnvironment();
const environment = target.name.toLowerCase();
const accountSlot = process.env.MX_AUTH_SLOT || "primary";
if (!["primary", "second"].includes(accountSlot)) throw new Error("Unsupported MX auth account slot.");
const label = `${target.name} MX${accountSlot === "second" ? " second account" : ""}`;
const HOSTNAME = target.hostname;
const API_HOSTNAME = `${environment}-smb-api-cdn.ecom-stg.samsung.com`;
const setupUrl = `https://${HOSTNAME}/getcookie.html`;
const homeUrl = `https://${HOSTNAME}/mx/`;
const profileDir = path.resolve(`playwright/profiles/${environment}-mx-${accountSlot === "second" ? "second" : "qa"}`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `mx-${environment}-${accountSlot === "second" ? "second-user" : "user"}.json`);
const authTempFile = `${authFile}.tmp`;
const sessionStorageFile = path.join(authDir, `mx-${environment}-${accountSlot === "second" ? "second-session-storage" : "session-storage"}.json`);
const sessionStorageTempFile = `${sessionStorageFile}.tmp`;
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");

let currentStep = `starting ${label} export`;

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
    throw new Error(`${step} left the allowed ${label} host`);
  }
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) {
    throw new Error(
      `the dedicated ${label} Chrome is not available; open its profile before exporting`
    );
  }
  const [portText] = fs.readFileSync(devToolsActivePortFile, "utf8").split("\n");
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`the dedicated ${label} Chrome debugging endpoint is invalid`);
  }
  return port;
}

async function profileButtonVisible(page, timeout = 3000) {
  if (page.isClosed()) return false;
  try {
    if (new URL(page.url()).hostname !== HOSTNAME) return false;
  } catch {
    return false;
  }
  return page
    .getByRole("button", { name: "My Profile", exact: true })
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function findLiveMxStorefront(context) {
  const candidates = context.pages().filter((page) => {
    if (page.isClosed()) return false;
    try {
      const url = new URL(page.url());
      return url.hostname === HOSTNAME && (url.pathname === "/mx" || url.pathname.startsWith("/mx/"));
    } catch {
      return false;
    }
  });

  for (const page of candidates.reverse()) {
    if (await profileButtonVisible(page, 5000)) return page;
  }
  return null;
}

async function openAuthenticatedProfileMenu(page) {
  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  reportStep("My Profile is visible");
  await profileButton.hover();

  await page.waitForFunction(() => {
    return [...document.querySelectorAll('[role="menu"].profile-menu')].some(
      (menu) =>
        menu.offsetParent !== null &&
        !menu.classList.contains("mat-menu-panel-animating") &&
        /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i.test(menu.innerText)
    );
  }, null, { timeout: 30000 });

  const profileMenu = page
    .locator('[role="menu"].profile-menu')
    .filter({ hasText: /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i })
    .filter({ visible: true })
    .last();
  if (!/Cerrar Sesi[oó]n/i.test(await profileMenu.innerText())) {
    throw new Error(
      `the ${label} profile menu is signed out; complete the manual login and keep Chrome open`
    );
  }
  reportStep("authenticated profile menu is open and Cerrar sesión is visible");
}

async function openMxStorefrontForExport(context) {
  const livePage = await findLiveMxStorefront(context);
  if (livePage) {
    reportStep(`reusing the live ${label} storefront already open in dedicated Chrome`);
    await livePage.bringToFront();
    return livePage;
  }

  const page = await context.newPage();
  reportStep(`no rendered MX tab found; opening ${label} cookie setup`);
  await page.goto(setupUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assertMxHost(page, "cookie setup");
  await page.getByText(/You can access pages now/i).waitFor({ state: "visible", timeout: 60000 });

  reportStep(`opening ${label} storefront`);
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assertMxHost(page, "storefront navigation");
  return page;
}

function writeJsonAtomically(tempFile, destination, value) {
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(tempFile, 0o600);
  fs.renameSync(tempFile, destination);
}

async function exportMxAuthentication() {
  fs.mkdirSync(authDir, { recursive: true });
  reportStep(`connecting to the live dedicated ${label} Chrome`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${readDevToolsPort()}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error(`the dedicated ${label} Chrome did not expose its browser context`);
  let page;

  try {
    page = await openMxStorefrontForExport(context);
    await openAuthenticatedProfileMenu(page);

    if (accountSlot === "second") {
      const cartPage = await context.newPage();
      try {
        await cartPage.goto(`https://${HOSTNAME}/mx/cart`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await cartPage.getByRole("main").getByText(/carrito|cart/i).first().waitFor({ state: "visible", timeout: 60000 });
      } finally {
        await cartPage.close();
      }
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await openAuthenticatedProfileMenu(page);
    }

    reportStep(`collecting filtered ${label} storage state`);
    const fullState = await context.storageState({ indexedDB: true });
    const mxState = {
      cookies: fullState.cookies.filter((cookie) => {
        const domain = cookie.domain.replace(/^\./, "");
        return domain === HOSTNAME || domain === API_HOSTNAME || cookie.domain === ".samsung.com";
      }),
      origins: fullState.origins.filter(
        ({ origin }) => new URL(origin).hostname === HOSTNAME
      ),
    };
    if (!mxState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
      throw new Error(`No ${label} storefront cookies were available for export`);
    }
    if (accountSlot === "second" && !mxState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === API_HOSTNAME)) {
      throw new Error(`No ${label} cart API cookies were available for export`);
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
    reportStep(`${label} auth state exported to dedicated ignored artifacts`);
    console.log(
      `[auth:export:mx] ${label} storefront and required parent-domain state exported; identity-provider and third-party state excluded`
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
