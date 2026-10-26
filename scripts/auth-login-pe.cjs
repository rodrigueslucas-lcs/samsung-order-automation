const { waitForManualStorefront } = require("../utils/authManualReturn.cjs");
const { chromium } = require("@playwright/test");
const { connectAuthBrowser } = require("../utils/authDedicatedBrowser.cjs");
const { completeAccountLogin, discardRejectedAccountPages } = require("../utils/authAccountLogin.cjs");
const { authProfileControl, openAuthProfile, prepareAuthStorefront } = require("../utils/authStorefrontReady.cjs");
const fs = require("node:fs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const { createAuthNavigation } = require("../utils/authNavigation.cjs");
const gotoWithTransientRetry = createAuthNavigation("pe");
const path = require("node:path");
const { getPeQstConfig } = require("../config/markets/pe");

const CONFIG = getPeQstConfig();
const HOSTNAME = CONFIG.baseUrl.hostname;
const API_HOSTNAME = `${CONFIG.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
const ENV_NAME = CONFIG.environment;
const ENV_SUFFIX = ENV_NAME.toLowerCase();
const ACCOUNT_HOSTNAME = "account.samsung.com";
const setupUrl = CONFIG.setupUrl?.href || `https://${HOSTNAME}/getcookie.html`;
const homeUrl = CONFIG.baseUrl.href;
const profileDir = path.resolve(`playwright/profiles/${ENV_SUFFIX}-pe-qa`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `pe-${ENV_SUFFIX}-user.json`);
const sessionStorageFile = path.join(authDir, `pe-${ENV_SUFFIX}-session-storage.json`);
const interactiveTimeout = Number(process.env.PE_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
const manualLogin = process.env.PE_AUTH_MANUAL === "1";

const localCredentialsFile = [
  path.join(authDir, "samsung-storefront-user.json"),
  path.join(authDir, "mx-storefront-user.json"),
  path.join(authDir, "pe-storefront-user.json"),
].find((candidate) => fs.existsSync(candidate)) || path.join(authDir, "samsung-storefront-user.json");

function readLocalCredentials() {
  if (!fs.existsSync(localCredentialsFile)) return {};
  const credentials = JSON.parse(fs.readFileSync(localCredentialsFile, "utf8"));
  return {
    email: String(credentials.email || "").trim(),
    password: String(credentials.password || ""),
  };
}

function resolveRuntimeCredentials() {
  const local = readLocalCredentials();
  const email = process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.PE_SAMSUNG_EMAIL?.trim() || local.email;
  const password = process.env.SAMSUNG_ACCOUNT_PASSWORD || process.env.PE_SAMSUNG_PASSWORD || local.password;
  if (!email || !password) {
    throw new Error(
      "Global Samsung Account credentials were not found. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or the ignored playwright/.auth/samsung-storefront-user.json once."
    );
  }
  return { email, password };
}

async function connectDedicatedChrome() {
  return connectAuthBrowser({ chromium, profileDir, market: "pe", environment: ENV_NAME, slot: "primary" });
}

function assertAllowedHost(page, allowed, step) {
  if (!allowed.includes(new URL(page.url()).hostname)) throw new Error(`${step} reached an unexpected host.`);
}

function isPeStorefront(page) {
  try {
    const url = new URL(page.url());
    return url.hostname === HOSTNAME && (url.pathname === "/pe" || url.pathname.startsWith("/pe/"));
  } catch {
    return false;
  }
}

async function hasRenderedStorefront(page, timeout = 3000) {
  if (!isPeStorefront(page)) return false;
  return authProfileControl(page)
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function findRenderedPePage(context, preferredPage = null) {
  const candidates = [preferredPage, ...context.pages().slice().reverse()]
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (await hasRenderedStorefront(candidate)) return candidate;
  }
  return null;
}

async function findAccountLoginPage(context, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of context.pages().slice().reverse()) {
      if (candidate.isClosed()) continue;
      try {
        if (new URL(candidate.url()).hostname !== ACCOUNT_HOSTNAME) continue;
        return candidate;
      } catch { /* The Samsung redirect may replace the tab while we inspect it. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function waitForProfileMenu(page) {
  return openAuthProfile(page, { market: "pe" });
}

async function openPeHome(page, context, { fresh = false } = {}) {
  const rendered = await findRenderedPePage(context, page);
  return prepareAuthStorefront(rendered || page, {
    market: "pe", setupUrl, homeUrl, navigate: gotoWithTransientRetry, fresh,
  });
}

function writeJsonSecurely(destination, value) {
  writeJsonAtomically(destination, value);
}

async function exportAuthenticatedState(context, page) {
  const fullState = await context.storageState({ indexedDB: true });
  const peState = {
    cookies: fullState.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, "");
      return domain === HOSTNAME || domain === API_HOSTNAME || domain === "pe-smb-api-cdn.ecom-stg.samsung.com" || cookie.domain === ".samsung.com";
    }),
    origins: fullState.origins.filter(({ origin }) => new URL(origin).hostname === HOSTNAME),
  };
  if (!peState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
    throw new Error(`No PE ${ENV_NAME} storefront cookies were available after login.`);
  }
  const sessionStorage = await page.evaluate(() => Object.fromEntries(
    Array.from({ length: window.sessionStorage.length }, (_, index) => {
      const key = window.sessionStorage.key(index);
      return [key, window.sessionStorage.getItem(key)];
    }).filter(([key]) => key !== null)
  ));
  fs.mkdirSync(authDir, { recursive: true });
  writeJsonSecurely(authFile, peState);
  writeJsonSecurely(sessionStorageFile, sessionStorage);
}

async function loginPeSamsungAccount() {
  const browser = await connectDedicatedChrome();
  const context = browser.contexts()[0];
  if (!context) throw new Error("Dedicated PE Chrome did not expose a browser context.");
  await discardRejectedAccountPages(context);
  const existingAccountPage = context.pages().find((candidate) => {
    try { return new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
  });
  let page = existingAccountPage || await findRenderedPePage(context) || await context.newPage();
  page.setDefaultTimeout(120000);

  try {
    let menuState = "signed-out";
    let login;
    if (existingAccountPage) {
      console.log("[auth:login:pe] resuming the existing Samsung Account tab in dedicated Chrome");
    } else {
      console.log(`[auth:login:pe] opening PE ${ENV_NAME} storefront in dedicated Chrome`);
      page = await openPeHome(page, context, { fresh: true });
      console.log(`[auth:login:pe] PE ${ENV_NAME} My Profile is visible`);
      ({ state: menuState, login } = await waitForProfileMenu(page));
      console.log("[auth:login:pe] PE profile menu is stable");

    }
    if (menuState === "signed-out") {
      if (!existingAccountPage) {
        console.log("[auth:login:pe] opening Samsung Account sign-in");
        await login.click();
        const accountCandidate = await findAccountLoginPage(context);
        if (!accountCandidate) {
          const storefrontPage = await findRenderedPePage(context);
          const currentMenu = storefrontPage ? await waitForProfileMenu(storefrontPage).catch(() => null) : null;
          if (currentMenu?.state === "authenticated") {
            console.log("[auth:login:pe] storefront became authenticated without an account-page navigation");
            page = storefrontPage;
            menuState = "authenticated";
          } else {
            throw new Error("Samsung Account sign-in did not open in the current tab or a new tab within 60 seconds.");
          }
        } else {
          page = accountCandidate;
          page.setDefaultTimeout(120000);
        }
      }
      if (menuState === "signed-out") {
        await require("../utils/authBrowserWindow.cjs").prepareAuthBrowserWindow(page);
        assertAllowedHost(page, [ACCOUNT_HOSTNAME], "Samsung Account login");
      }

      if (menuState === "signed-out" && manualLogin) {
        console.log(`[auth:login:pe] Samsung Account login is ready in the visible Chrome. Complete login/CAPTCHA/MFA manually; automation will resume after the authenticated PE ${ENV_NAME} return.`);
        page = await waitForManualStorefront(context, page, {
          hostname: HOSTNAME, market: "pe", timeout: interactiveTimeout,
        });
      } else if (menuState === "signed-out") {
        await completeAccountLogin(page, { market: "pe", hostname: HOSTNAME, credentials: resolveRuntimeCredentials, timeout: interactiveTimeout });
      }
    }

    console.log("[auth:login:pe] validating authenticated storefront after return");
    let authenticatedMenu = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      page = await openPeHome(page, context);
      const menuResult = await waitForProfileMenu(page).catch(() => null);
      if (menuResult?.state === "authenticated") {
        authenticatedMenu = menuResult;
        break;
      }
      if (attempt < 3) {
        console.log(`[auth:login:pe] authenticated menu not propagated yet; retrying storefront validation (${attempt}/3)`);
        await page.waitForTimeout(3000);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      }
    }
    if (!authenticatedMenu) {
      throw new Error(`PE ${ENV_NAME} returned from Samsung Account but the authenticated profile menu did not propagate after 3 storefront checks.`);
    }
    console.log("[auth:login:pe] authenticated PE profile menu validated");
    await exportAuthenticatedState(context, page);
    console.log("[auth:login:pe] ignored PE auth state exported successfully");
  } finally {
    await browser.close().catch(() => {});
  }
}

loginPeSamsungAccount().catch((error) => {
  const summary = String(error.message || "unknown error").split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:login:pe] ${error.name}: ${summary}`);
  process.exitCode = error.exitCode || (/Target page, context or browser has been closed|browser has been closed|Target closed|frame was detached/i.test(summary) ? 75 : 1);
});
