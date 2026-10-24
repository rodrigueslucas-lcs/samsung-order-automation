const { chromium } = require("@playwright/test");
const { connectAuthBrowser } = require("../utils/authDedicatedBrowser.cjs");
const { createAuthNavigation } = require("../utils/authNavigation.cjs");
const { authProfileControl, openAuthProfile, prepareAuthStorefront } = require("../utils/authStorefrontReady.cjs");
const gotoWithTransientRetry = createAuthNavigation("mx");
const fs = require("node:fs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const path = require("node:path");
const { resolveMxEnvironment } = require("../utils/mxConfig");
const { hasMxAccountReturned, redactMxAuthError } = require("../utils/mxAuthLoginStep.cjs");
const { completeAccountLogin } = require("../utils/authAccountLogin.cjs");

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

function useAutomaticLogin() {
  if (!manualLogin) return true;
  if (accountSlot !== 'second') return false;
  const local = readLocalCredentials();
  return Boolean((process.env.MX_SECOND_SAMSUNG_EMAIL?.trim() || local.email) && (process.env.MX_SECOND_SAMSUNG_PASSWORD || local.password));
}

function resolveRuntimeCredentials() {
  const local = readLocalCredentials();
  const email = accountSlot === "second"
    ? process.env.MX_SECOND_SAMSUNG_EMAIL?.trim() || local.email
    : process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.MX_SAMSUNG_EMAIL?.trim() || local.email;
  const password = accountSlot === "second"
    ? process.env.MX_SECOND_SAMSUNG_PASSWORD || local.password
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

async function connectDedicatedChrome() {
  return connectAuthBrowser({ chromium, profileDir, market: "mx", environment: ENV_NAME, slot: accountSlot });
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
  return authProfileControl(page)
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

async function prepareMxWindow(page) {
  await require("../utils/authBrowserWindow.cjs").prepareAuthBrowserWindow(page);
}

async function waitForProfileMenu(page) {
  return openAuthProfile(page, { market: "mx", prepareWindow: prepareMxWindow });
}

async function isAuthenticated(page) {
  if (!isMxStorefront(page)) return false;
  try {
    return (await waitForProfileMenu(page)).state === "authenticated";
  } catch {
    return false;
  }
}

async function goToMxStorefront(page) {
  return prepareAuthStorefront(page, { market: "mx", setupUrl, homeUrl, navigate: gotoWithTransientRetry, prepareWindow: prepareMxWindow, fresh: true });
}

async function startLogin(page) {
  const { login } = await waitForProfileMenu(page);
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
    // Warm Samsung SSO can complete before an Account page is observed.
    if (isMxStorefront(currentPage) && await isAuthenticated(currentPage)) return null;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Samsung Account page did not open within 120 seconds.");
}

async function fillSamsungAccount(page, credentials) {
  await prepareMxWindow(page, true);
  await completeAccountLogin(page, { market: "mx", hostname: HOSTNAME, credentials, timeout: interactiveTimeout });
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
  writeJsonAtomically(authFile, await context.storageState());
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

    const existingAccountPage = context.pages().find(candidate => {
      try { return new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
    });
    let page = existingAccountPage || await findRenderedMxPage(context) || await context.newPage();
    await prepareMxWindow(page, true);
    if (!existingAccountPage) {
      console.log(`[auth:login:mx] preparing ${ENV_NAME} ${accountSlot} storefront`);
      await goToMxStorefront(page);
    } else {
      console.log("[auth:login:mx] resuming the existing Samsung Account tab; preserving login/CAPTCHA/MFA");
    }

    if (await isAuthenticated(page)) {
      await exportState(context, page);
      return;
    }

    if (!existingAccountPage) {
      console.log("[auth:login:mx] opening Samsung Account sign-in");
      await startLogin(page);
    }
    const accountPage = existingAccountPage || await waitForSamsungAccountPage(context, page);

    if (accountPage && useAutomaticLogin()) {
      await fillSamsungAccount(accountPage, resolveRuntimeCredentials);
    } else if (accountPage) {
      await require('../utils/authAccountQr.cjs').openSecondAccountQr(accountPage,{slot:accountSlot});
      try { await prepareMxWindow(accountPage, true); }
      catch (error) { if (!hasMxAccountReturned(accountPage, HOSTNAME)) throw error; }
      console.log(`[auth:login:mx] manual mode for ${ENV_NAME} ${accountSlot}; complete this account's Samsung Account login/CAPTCHA/MFA in the maximized Chrome.`);
    }

    page = await waitForAuthenticatedStorefront(context, page);
    await exportState(context, page);
  } catch (error) {
    console.error(`[auth:login:mx] ${redactMxAuthError(error)}`);
    process.exitCode = error.exitCode || 1;
  } finally {
    await browser?.close().catch(() => {});
  }
})();
