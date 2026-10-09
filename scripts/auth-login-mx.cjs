const { chromium } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const path = require("node:path");
const { resolveMxEnvironment } = require("../utils/mxConfig");

const TARGET = resolveMxEnvironment();
const HOSTNAME = TARGET.hostname;
const API_HOSTNAME = `${TARGET.name.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
const ENV_NAME = TARGET.name;
const ENV_SUFFIX = ENV_NAME.toLowerCase();
const accountSlot = process.env.MX_AUTH_SLOT || "primary";
if (!["primary", "second"].includes(accountSlot)) throw new Error("Unsupported MX auth account slot.");
const ACCOUNT_HOSTNAME = "account.samsung.com";
const setupUrl = `https://${HOSTNAME}/getcookie.html`;
const homeUrl = `https://${HOSTNAME}/mx/`;
const profileDir = path.resolve(`playwright/profiles/${ENV_SUFFIX}-mx-${accountSlot === "second" ? "second" : "qa"}`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `mx-${ENV_SUFFIX}-${accountSlot === "second" ? "second-user" : "user"}.json`);
const sessionStorageFile = path.join(authDir, `mx-${ENV_SUFFIX}-${accountSlot === "second" ? "second-session-storage" : "session-storage"}.json`);
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");
const interactiveTimeout = Number(process.env.MX_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
const manualLogin = process.env.MX_AUTH_MANUAL === "1";

const localCredentialCandidates = accountSlot === "second"
  ? [
      path.join(authDir, "mx-second-storefront-user.json"),
    ]
  : [
      path.join(authDir, "samsung-storefront-user.json"),
      path.join(authDir, "mx-storefront-user.json"),
    ];

function readLocalCredentials() {
  const localCredentialsFile = localCredentialCandidates.find((candidate) => fs.existsSync(candidate));
  if (!localCredentialsFile) return {};
  const credentials = JSON.parse(fs.readFileSync(localCredentialsFile, "utf8"));
  return {
    email: String(credentials.email || "").trim(),
    password: String(credentials.password || ""),
  };
}

function resolveRuntimeCredentials() {
  const local = readLocalCredentials();
  const email = accountSlot === "second"
    ? process.env.MX_SECOND_SAMSUNG_EMAIL?.trim() || process.env.MX_SAMSUNG_EMAIL?.trim() || local.email
    : process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.MX_SAMSUNG_EMAIL?.trim() || local.email;
  const password = accountSlot === "second"
    ? process.env.MX_SECOND_SAMSUNG_PASSWORD || process.env.MX_SAMSUNG_PASSWORD || local.password
    : process.env.SAMSUNG_ACCOUNT_PASSWORD || process.env.MX_SAMSUNG_PASSWORD || local.password;
  if (!email || !password) {
    throw new Error(
      accountSlot === "second"
        ? "MX second-account credentials were not found. Set MX_SECOND_SAMSUNG_EMAIL/MX_SECOND_SAMSUNG_PASSWORD, use MX_AUTH_MANUAL=1, or create ignored playwright/.auth/mx-second-storefront-user.json."
        : "Global Samsung Account credentials were not found. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or the ignored playwright/.auth/samsung-storefront-user.json once. MX_SAMSUNG_EMAIL/MX_SAMSUNG_PASSWORD and mx-storefront-user.json remain supported as compatibility fallbacks."
    );
  }
  return { email, password };
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) return null;
  const port = Number(fs.readFileSync(devToolsActivePortFile, "utf8").split(/\r?\n/)[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

async function connectDedicatedChrome() {
  const existingPort = readDevToolsPort();
  if (existingPort) {
    const existing = await chromium.connectOverCDP(`http://127.0.0.1:${existingPort}`).catch(() => null);
    if (existing) return existing;
  }

  fs.rmSync(devToolsActivePortFile, { force: true });
  const launcher = spawnSync(process.execPath, [path.resolve("scripts/auth-open-profile-mx.cjs")], {
    stdio: "inherit",
  });
  if (launcher.status !== 0) throw new Error("Dedicated MX Chrome could not be launched automatically.");

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const port = readDevToolsPort();
    if (port) {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
      if (browser) return browser;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Dedicated MX Chrome did not expose CDP within 30 seconds.");
}

function assertAllowedHost(page, allowed, step) {
  if (!allowed.includes(new URL(page.url()).hostname)) throw new Error(`${step} reached an unexpected host.`);
}

function isMxStorefront(page) {
  try {
    const url = new URL(page.url());
    return url.hostname === HOSTNAME && (url.pathname === "/mx" || url.pathname.startsWith("/mx/"));
  } catch {
    return false;
  }
}

async function hasRenderedStorefront(page, timeout = 3000) {
  if (!isMxStorefront(page)) return false;
  return page.getByRole("button", { name: "My Profile", exact: true })
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function findRenderedMxPage(context, preferredPage = null) {
  const candidates = [preferredPage, ...context.pages().slice().reverse()]
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (await hasRenderedStorefront(candidate)) return candidate;
  }
  return null;
}

async function waitForProfileMenu(page) {
  const profile = page.getByRole("button", { name: "My Profile", exact: true });
  await profile.waitFor({ state: "visible", timeout: 120000 });
  await profile.hover();
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('[role="menu"].profile-menu')].some(
      (current) => current.offsetParent !== null &&
        !current.classList.contains("mat-menu-panel-animating") &&
        /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i.test(current.innerText)
    );
  }, null, { timeout: 120000 });
}

async function isAuthenticated(page) {
  if (!isMxStorefront(page)) return false;
  try {
    await waitForProfileMenu(page);
    const menu = page.locator('[role="menu"].profile-menu').filter({ visible: true }).first();
    const text = await menu.innerText();
    return /Cerrar Sesi[oó]n/i.test(text) && !/Iniciar Sesi[oó]n/i.test(text);
  } catch {
    return false;
  }
}

async function goToMxStorefront(page) {
  await page.goto(setupUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  assertAllowedHost(page, [HOSTNAME], "MX setup");
  if (page.url() !== homeUrl) {
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  }
  assertAllowedHost(page, [HOSTNAME], "MX storefront");
}

async function startLogin(page) {
  await waitForProfileMenu(page);
  const menu = page.locator('[role="menu"].profile-menu').filter({ visible: true }).first();
  const login = menu.getByText(/Iniciar Sesi[oó]n/i).first();
  if (!(await login.isVisible().catch(() => false))) return false;
  await login.click();
  return true;
}

async function waitForSamsungAccountPage(context, currentPage) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    for (const candidate of context.pages().slice().reverse()) {
      try {
        if (new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME) return candidate;
      } catch {}
    }
    try {
      if (new URL(currentPage.url()).hostname === ACCOUNT_HOSTNAME) return currentPage;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Samsung Account page did not open within 120 seconds.");
}

async function fillSamsungAccount(page, credentials) {
  const email = page.locator('input[type="email"], input[name="email"], #iptLgnPlnID').first();
  await email.waitFor({ state: "visible", timeout: 120000 });
  await email.fill(credentials.email);

  const password = page.locator('input[type="password"], input[name="password"], #iptLgnPlnPD').first();
  if (!(await password.isVisible().catch(() => false))) {
    const next = page.getByRole("button", { name: /Siguiente|Next|Continuar/i }).first();
    if (await next.isVisible().catch(() => false)) await next.click();
  }
  await password.waitFor({ state: "visible", timeout: 120000 });
  await password.fill(credentials.password);

  const signIn = page.getByRole("button", { name: /Iniciar sesi[oó]n|Sign in/i }).first();
  await signIn.click();
}

async function waitForAuthenticatedStorefront(context, preferredPage) {
  const deadline = Date.now() + interactiveTimeout;
  while (Date.now() < deadline) {
    const storefront = await findRenderedMxPage(context, preferredPage);
    if (storefront && await isAuthenticated(storefront)) return storefront;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`MX authentication did not complete within ${interactiveTimeout}ms.`);
}

async function exportState(context, page) {
  fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: authFile });
  const sessionStorage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
  writeJsonAtomically(sessionStorageFile, sessionStorage);
  console.log(`[auth:login:mx] exported ${ENV_NAME} ${accountSlot} session -> ${authFile}`);
}

(async () => {
  let browser;
  try {
    browser = await connectDedicatedChrome();
    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) throw new Error("Dedicated MX Chrome has no browser context.");

    let page = context.pages()[0] || await context.newPage();
    await goToMxStorefront(page);

    if (await isAuthenticated(page)) {
      await exportState(context, page);
      return;
    }

    await startLogin(page);
    const accountPage = await waitForSamsungAccountPage(context, page);

    if (!manualLogin) {
      const credentials = resolveRuntimeCredentials();
      await fillSamsungAccount(accountPage, credentials);
    } else {
      console.log("[auth:login:mx] manual mode active; complete Samsung Account login/CAPTCHA/MFA in the opened Chrome.");
    }

    page = await waitForAuthenticatedStorefront(context, page);
    await exportState(context, page);
  } catch (error) {
    console.error(`[auth:login:mx] ${error.stack || error.message || error}`);
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => {});
  }
})();
