const { waitForManualStorefront } = require("../utils/authManualReturn.cjs");
const { chromium } = require("@playwright/test");
const { connectAuthBrowser } = require("../utils/authDedicatedBrowser.cjs");
const { completeAccountLogin, discardRejectedAccountPages } = require("../utils/authAccountLogin.cjs");
const { authProfileControl, openAuthProfile, prepareAuthStorefront } = require("../utils/authStorefrontReady.cjs");
const { createAuthNavigation } = require("../utils/authNavigation.cjs");
const gotoWithTransientRetry = createAuthNavigation("co");
const { prepareAuthBrowserWindow } = require("../utils/authBrowserWindow.cjs");
const fs = require("node:fs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const path = require("node:path");
const { getCoQstConfig } = require("../config/markets/co");

const CONFIG = getCoQstConfig();
const HOSTNAME = CONFIG.baseUrl.hostname;
const API_HOSTNAME = CONFIG.environment === "S2"
  ? "s2-smb-api-cdn.ecom-stg.samsung.com"
  : "co-smb-api-cdn.ecom-stg.samsung.com";
const ENV_NAME = CONFIG.environment;
const ENV_SUFFIX = ENV_NAME.toLowerCase();
const accountSlot = String(process.env.CO_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(accountSlot)) throw new Error(`Unsupported CO auth slot: ${accountSlot}.`);
const ACCOUNT_HOSTNAME = "account.samsung.com";
const setupUrl = CONFIG.setupUrl?.href || `https://${HOSTNAME}/getcookie.html`;
const homeUrl = CONFIG.baseUrl.href;
const profileDir = path.resolve(`playwright/profiles/${ENV_SUFFIX}-co-${accountSlot === "second" ? "second" : "qa"}`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `co-${ENV_SUFFIX}-${accountSlot === "second" ? "second-user" : "user"}.json`);
const sessionStorageFile = path.join(authDir, `co-${ENV_SUFFIX}-${accountSlot === "second" ? "second-session-storage" : "session-storage"}.json`);
const interactiveTimeout = Number(process.env.CO_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
const manualLogin = process.env.CO_AUTH_MANUAL === "1";
const preQa2CdpUrl = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";
const preQa2ExcludedParentCookies = /^spr-chat|^_ga|^visit_count|^AMCV|^kndctr|^_ba_|^_cl|^mbox|^_gcl|^_fbp|^cto_bundle|^s_sq|^s_ecid|^s_fpid|^FPAU|^_uetvid|^pv$|^(mx-cart|pe-cart)$/;

const localCredentialsFile = (accountSlot === "second"
  ? [path.join(authDir, "co-second-storefront-user.json"), path.join(authDir, "mx-second-storefront-user.json")]
  : [path.join(authDir, "samsung-storefront-user.json"), path.join(authDir, "mx-storefront-user.json"), path.join(authDir, "co-storefront-user.json")]
).find((candidate) => fs.existsSync(candidate));

function readLocalCredentials() {
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
  return Boolean((process.env.CO_SECOND_SAMSUNG_EMAIL?.trim() || local.email) && (process.env.CO_SECOND_SAMSUNG_PASSWORD || local.password));
}

function resolveRuntimeCredentials() {
  const local = readLocalCredentials();
  const email = accountSlot === "second"
    ? process.env.CO_SECOND_SAMSUNG_EMAIL?.trim() || local.email
    : process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.CO_SAMSUNG_EMAIL?.trim() || local.email;
  const password = accountSlot === "second"
    ? process.env.CO_SECOND_SAMSUNG_PASSWORD || local.password
    : process.env.SAMSUNG_ACCOUNT_PASSWORD || process.env.CO_SAMSUNG_PASSWORD || local.password;
  if (!email || !password) {
    throw new Error(
      accountSlot === "second"
        ? "CO second-account credentials are unavailable. Use CO_AUTH_MANUAL=1 for interactive Samsung login or configure dedicated second-account credentials locally."
        : "Global Samsung Account credentials were not found. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or the ignored playwright/.auth/samsung-storefront-user.json once."
    );
  }
  return { email, password };
}

async function connectDedicatedChrome() {
  return connectAuthBrowser({ chromium, profileDir, market: "co", environment: ENV_NAME, slot: accountSlot });
}

function assertAllowedHost(page, allowed, step) {
  if (!allowed.includes(new URL(page.url()).hostname)) throw new Error(`${step} reached an unexpected host.`);
}

function isCoStorefront(page) {
  try {
    const url = new URL(page.url());
    return url.hostname === HOSTNAME && (url.pathname === "/co" || url.pathname.startsWith("/co/"));
  } catch {
    return false;
  }
}

function profileControl(page) { return authProfileControl(page); }

async function hasRenderedStorefront(page, timeout = 3000) {
  if (!isCoStorefront(page)) return false;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline && !page.isClosed()) {
    await dismissCoNotificationTutorial(page);
    if (await profileControl(page).isVisible().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function dismissCoNotificationTutorial(page) {
  // This Insiders tutorial makes the profile inaccessible (aria-hidden) even
  // when its icon can still be seen behind the overlay.
  const notice = page.getByText(/^¡Listo!$/i).filter({ visible: true }).first();
  if (!(await notice.isVisible().catch(() => false))) return;
  await notice.click({ timeout: 3000 }).catch(async () => {
    await notice.evaluate((element) => element.click()).catch(() => {});
  });
  await notice.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  console.log("[auth:login:co] dismissed CO notifications tutorial");
}

async function maximizeDedicatedChrome(page) {
  await prepareAuthBrowserWindow(page);
}

async function closeDedicatedDevTools(context) {
  // Docked DevTools is a CDP "other" target, not necessarily a Playwright page.
  // Closing only context.pages() leaves it open and halves the storefront width.
  const browserSession = await context.browser().newBrowserCDPSession();
  try {
    const { targetInfos } = await browserSession.send("Target.getTargets");
    for (const target of targetInfos) {
      if (!target.url.startsWith("devtools://")) continue;
      await browserSession.send("Target.closeTarget", { targetId: target.targetId });
      console.log("[auth:login:co] closed docked DevTools in dedicated CO Chrome");
    }
  } finally {
    await browserSession.detach();
  }
  for (const candidate of context.pages()) {
    if (!candidate.url().startsWith("devtools://")) continue;
    await candidate.close();
    console.log("[auth:login:co] closed DevTools in dedicated CO Chrome to restore storefront viewport");
  }
}

async function findRenderedCoPage(context, preferredPage = null) {
  const candidates = [preferredPage, ...context.pages().slice().reverse()]
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  for (const candidate of candidates) {
    if (await hasRenderedStorefront(candidate)) return candidate;
  }
  return null;
}

async function waitForProfileMenu(page) {
  return openAuthProfile(page, { market: "co", prepareWindow: maximizeDedicatedChrome });
}

async function clickSamsungAccountSignIn(page) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const menuResult = await waitForProfileMenu(page);
    if (menuResult.state === "authenticated") return "authenticated";

    const clicked = await menuResult.login.evaluate((element) => {
      element.click();
      return true;
    }).catch(() => false);

    if (clicked) {
      console.log(`[auth:login:co] Samsung Account sign-in action dispatched (${attempt}/3)`);
      return "clicked";
    }

    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(750);
  }

  throw new Error("CO sign-in action was visible, but the Samsung Account navigation could not be dispatched after 3 menu reopen attempts.");
}

async function openCoHome(page, context, { fresh = false } = {}) {
  await closeDedicatedDevTools(context);
  const rendered = await findRenderedCoPage(context, page);
  return prepareAuthStorefront(rendered || page, {
    market: "co", setupUrl, homeUrl, navigate: gotoWithTransientRetry, fresh,
    prepareWindow: maximizeDedicatedChrome,
  });
}

function writeJsonSecurely(destination, value) {
  writeJsonAtomically(destination, value);
}

async function exportAuthenticatedState(context, page) {
  const fullState = await context.storageState({ indexedDB: true });
  const coState = {
    cookies: fullState.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, "");
      return domain === HOSTNAME || domain === API_HOSTNAME || domain === `${ENV_SUFFIX}-smb-api-cdn.ecom-stg.samsung.com` ||
        (HOSTNAME === "p6-pre-qa2.samsung.com" &&
          ["wds.samsung.com", "sts.secsso.net", "account.samsung.com"].includes(domain)) ||
        (cookie.domain === ".samsung.com" &&
          (HOSTNAME !== "p6-pre-qa2.samsung.com" || !preQa2ExcludedParentCookies.test(cookie.name)));
    }),
    origins: fullState.origins.filter(({ origin }) => new URL(origin).hostname === HOSTNAME),
  };
  if (!coState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
    throw new Error(`No CO ${ENV_NAME} storefront cookies were available after login.`);
  }
  const sessionStorage = await page.evaluate(() => Object.fromEntries(
    Array.from({ length: window.sessionStorage.length }, (_, index) => {
      const key = window.sessionStorage.key(index);
      return [key, window.sessionStorage.getItem(key)];
    }).filter(([key]) => key !== null)
  ));
  fs.mkdirSync(authDir, { recursive: true });
  writeJsonSecurely(authFile, coState);
  writeJsonSecurely(sessionStorageFile, sessionStorage);
}

async function findAuthenticatedPreQaCoPage(context) {
  for (const page of context.pages().slice().reverse()) {
    if (!isCoStorefront(page)) continue;
    await prepareAuthBrowserWindow(page);
    const profile = page.locator("button.nv00-gnb-v4__utility-user").filter({ visible: true }).first();
    if (!(await profile.isVisible().catch(() => false))) continue;
    const logout = page.getByText(/Cerrar Sesi[oó]n/i).filter({ visible: true }).first();
    if (!(await logout.isVisible().catch(() => false))) await profile.click();
    if (await logout.isVisible().catch(() => false)) return page;
  }
  return null;
}

async function loginCoPreQa2SharedChrome() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(preQa2CdpUrl);
  } catch {
    throw new Error(`PreQA2 shared Chrome is unavailable at ${preQa2CdpUrl}. Open the WMC-authenticated Chrome before refreshing CO S2.`);
  }
  let temporaryPage;
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("PreQA2 shared Chrome has no browser context.");
    console.log(`[auth:login:co] reusing the WMC-authenticated PreQA2 Chrome at ${preQa2CdpUrl}`);
    let page = await findAuthenticatedPreQaCoPage(context);
    if (!page) {
      const existingCoPage = context.pages().find((candidate) => isCoStorefront(candidate));
      page = existingCoPage || await context.newPage();
      if (!existingCoPage) {
        temporaryPage = page;
        await gotoWithTransientRetry(page, homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      }
      if (!isCoStorefront(page)) {
        throw new Error(`CO S2 did not reach ${HOSTNAME}/co/. Complete WMC → Samsung Employees → AD SSO Login → QA / PreQA2 in the shared Chrome.`);
      }
      const profile = page.locator("button.nv00-gnb-v4__utility-user").filter({ visible: true }).first();
      await profile.waitFor({ state: "visible", timeout: 30000 });
      await profile.click();
      const { login } = accountActions(page);
      if (!(await login.isVisible().catch(() => false))) {
        throw new Error("CO PreQA2 account menu has neither authenticated logout nor a visible sign-in action.");
      }
      await login.click();
      console.log("[auth:login:co] Complete Samsung Account login/CAPTCHA/MFA in the shared Chrome; waiting for the authenticated CO return.");
      const deadline = Date.now() + interactiveTimeout;
      let authenticatedPage = null;
      while (Date.now() < deadline && !authenticatedPage) {
        authenticatedPage = await findAuthenticatedPreQaCoPage(context);
        if (!authenticatedPage) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!authenticatedPage) {
        throw new Error("Samsung Account did not return to an authenticated CO PreQA2 storefront within the allowed time.");
      }
      page = authenticatedPage;
    }
    await exportAuthenticatedState(context, page);
    console.log("[auth:login:co] authenticated CO S2 state exported from the shared PreQA2 Chrome");
  } finally {
    if (temporaryPage) await temporaryPage.close().catch(() => {});
    // connectOverCDP owns only this client connection; keep the external Chrome
    // context and every pre-existing tab open for the PreQA2 test campaign.
    await browser.close().catch(() => {});
  }
}

async function loginCoSamsungAccount() {
  const browser = await connectDedicatedChrome();
  const context = browser.contexts()[0];
  if (!context) throw new Error("Dedicated CO Chrome did not expose a browser context.");
  await closeDedicatedDevTools(context);
  await discardRejectedAccountPages(context);
  const existingAccountPage = context.pages().find((candidate) => {
    try { return new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
  });
  let page = existingAccountPage || await findRenderedCoPage(context) || context.pages().slice(-1)[0] || await context.newPage();
  page.setDefaultTimeout(120000);

  try {
    // A restored CO window can reopen at mobile width despite --start-maximized.
    // The desktop My Profile button is then present but has a 0x0 bounding box.
    await maximizeDedicatedChrome(page);
    let menuState = "signed-out";
    if (existingAccountPage) {
      console.log("[auth:login:co] resuming the existing Samsung Account tab in dedicated Chrome");
    } else {
      console.log(`[auth:login:co] opening CO ${ENV_NAME} storefront in dedicated Chrome`);
      page = await openCoHome(page, context, { fresh: true });
      console.log(`[auth:login:co] CO ${ENV_NAME} My Profile is visible`);
      const menuResult = await waitForProfileMenu(page);
      console.log(`[auth:login:co] CO profile actions are stable (${menuResult.state})`);
      menuState = menuResult.state;
    }
    if (menuState === "signed-out") {
      if (!existingAccountPage) {
        console.log("[auth:login:co] opening Samsung Account sign-in");
        const pagesBeforeLogin = new Set(context.pages());
        const signInDispatch = await clickSamsungAccountSignIn(page);
        if (signInDispatch === "authenticated") {
          menuState = "authenticated";
        } else {
          const accountPage = await Promise.race([
            page.waitForURL((url) => url.hostname === ACCOUNT_HOSTNAME, { timeout: 60000 }).then(() => page).catch(() => null),
            context.waitForEvent("page", { timeout: 60000 }).then(async (candidate) => {
              await candidate.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
              return candidate;
            }).catch(() => null),
          ]);
          const accountCandidate = accountPage && (() => {
            try { return new URL(accountPage.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
          })() ? accountPage : context.pages().find((candidate) => {
            if (pagesBeforeLogin.has(candidate)) return false;
            try { return new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
          });
          if (!accountCandidate) {
            const currentMenu = await waitForProfileMenu(page).catch(() => null);
            if (currentMenu?.state === "authenticated") {
              console.log("[auth:login:co] storefront became authenticated without an account-page navigation");
              menuState = "authenticated";
            } else {
              throw new Error("Samsung Account sign-in did not open in the current tab or a new tab within 60 seconds.");
            }
          } else {
            page = accountCandidate;
          }
        }
      }
      if (menuState === "signed-out") {
        await prepareAuthBrowserWindow(page);
        assertAllowedHost(page, [ACCOUNT_HOSTNAME], "Samsung Account login");
      }

      if (menuState === "signed-out" && !useAutomaticLogin()) {
        await require('../utils/authAccountQr.cjs').openSecondAccountQr(page,{slot:accountSlot});
        console.log(`[auth:login:co] Samsung Account login is ready in the visible Chrome. Complete login/CAPTCHA/MFA manually; automation will resume after the authenticated CO ${ENV_NAME} return.`);
        page = await waitForManualStorefront(context, page, {
          hostname: HOSTNAME, market: "co", timeout: interactiveTimeout,
        });
      } else if (menuState === "signed-out") {
        await completeAccountLogin(page, { market: "co", hostname: HOSTNAME, credentials: resolveRuntimeCredentials, timeout: interactiveTimeout });
      }
    }

    console.log("[auth:login:co] validating authenticated storefront after return");
    let authenticatedMenu = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      page = await openCoHome(page, context);
      const menuResult = await waitForProfileMenu(page).catch(() => null);
      if (menuResult?.state === "authenticated") {
        authenticatedMenu = menuResult;
        break;
      }
      if (attempt < 3) {
        console.log(`[auth:login:co] authenticated menu not propagated yet; retrying storefront validation (${attempt}/3)`);
        await page.waitForTimeout(3000);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      }
    }
    if (!authenticatedMenu) {
      throw new Error(`CO ${ENV_NAME} returned from Samsung Account but the authenticated profile menu did not propagate after 3 storefront checks.`);
    }
    console.log("[auth:login:co] authenticated CO profile menu validated");
    await exportAuthenticatedState(context, page);
    console.log("[auth:login:co] ignored CO auth state exported successfully");
  } finally {
    await browser.close().catch(() => {});
  }
}

(ENV_NAME === "S2" && HOSTNAME === "p6-pre-qa2.samsung.com"
  ? loginCoPreQa2SharedChrome()
  : loginCoSamsungAccount()).catch((error) => {
  const summary = String(error.message || "unknown error").split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:login:co] ${error.name}: ${summary}`);
  process.exitCode = error.exitCode || (/Target page, context or browser has been closed|browser has been closed|Target closed|frame was detached/i.test(summary) ? 75 : 1);
});
