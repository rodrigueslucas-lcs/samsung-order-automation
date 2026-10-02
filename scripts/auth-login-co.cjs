const { chromium } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
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
const ACCOUNT_HOSTNAME = "account.samsung.com";
const setupUrl = CONFIG.setupUrl?.href || `https://${HOSTNAME}/getcookie.html`;
const homeUrl = CONFIG.baseUrl.href;
const profileDir = path.resolve(`playwright/profiles/${ENV_SUFFIX}-co-qa`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `co-${ENV_SUFFIX}-user.json`);
const sessionStorageFile = path.join(authDir, `co-${ENV_SUFFIX}-session-storage.json`);
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");
const interactiveTimeout = Number(process.env.CO_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
const manualLogin = process.env.CO_AUTH_MANUAL === "1";
const preQa2CdpUrl = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";
const preQa2ExcludedParentCookies = /^spr-chat|^_ga|^visit_count|^AMCV|^kndctr|^_ba_|^_cl|^mbox|^_gcl|^_fbp|^cto_bundle|^s_sq|^s_ecid|^s_fpid|^FPAU|^_uetvid|^pv$|^(mx-cart|pe-cart)$/;

const localCredentialsFile = [
  path.join(authDir, "samsung-storefront-user.json"),
  path.join(authDir, "mx-storefront-user.json"),
  path.join(authDir, "co-storefront-user.json"),
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
  const email = process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.CO_SAMSUNG_EMAIL?.trim() || local.email;
  const password = process.env.SAMSUNG_ACCOUNT_PASSWORD || process.env.CO_SAMSUNG_PASSWORD || local.password;
  if (!email || !password) {
    throw new Error(
      "Global Samsung Account credentials were not found. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or the ignored playwright/.auth/samsung-storefront-user.json once."
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
  const launcher = spawnSync(process.execPath, [path.resolve("scripts/auth-open-profile-co.cjs")], {
    stdio: "inherit",
  });
  if (launcher.status !== 0) throw new Error("Dedicated CO Chrome could not be launched automatically.");

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const port = readDevToolsPort();
    if (port) {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
      if (browser) return browser;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Dedicated CO Chrome did not expose CDP within 30 seconds.");
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

function profileControl(page) {
  return page
    .getByRole("button", { name: "My Profile", exact: true })
    .or(page.locator("button.nv00-gnb-v4__utility-user"))
    .or(page.locator('[data-an-tr="account"], [data-an-la*="account" i]'))
    .filter({ visible: true })
    .first();
}

async function hasRenderedStorefront(page, timeout = 3000) {
  if (!isCoStorefront(page)) return false;
  return profileControl(page)
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
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
  const profile = profileControl(page);
  await profile.waitFor({ state: "visible", timeout: 120000 });

  const menu = page.locator('[role="menu"].profile-menu')
    .filter({ hasText: /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i })
    .filter({ visible: true })
    .last();

  await profile.hover();
  const openedFromHover = await menu
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!openedFromHover) {
    await profile.click();
  }

  await menu.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('[role="menu"].profile-menu')].some(
      (current) => current.offsetParent !== null &&
        !current.classList.contains("mat-menu-panel-animating") &&
        /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i.test(current.innerText)
    );
  }, null, { timeout: 30000 });

  return { profile, menu };
}

async function openCoHome(page, context) {
  const renderedBeforeNavigation = await findRenderedCoPage(context, page);
  if (renderedBeforeNavigation) {
    console.log(`[auth:login:co] reusing an already rendered CO ${ENV_NAME} storefront tab`);
    return renderedBeforeNavigation;
  }

  await page.goto(setupUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assertAllowedHost(page, [HOSTNAME], "CO setup");
  await page.getByText(/You can access pages now/i).waitFor({ timeout: 60000 });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    assertAllowedHost(page, [HOSTNAME], "CO storefront");
    if (await hasRenderedStorefront(page, 30000)) return page;

    const renderedSibling = await findRenderedCoPage(context);
    if (renderedSibling) {
      console.log("[auth:login:co] current CO tab is blank; switching to a rendered sibling CO tab");
      return renderedSibling;
    }
    if (attempt < 3) await page.waitForTimeout(3000);
  }
  throw new Error(`CO ${ENV_NAME} storefront did not render My Profile after 3 navigation attempts and no rendered sibling tab was available.`);
}

async function waitForStorefrontOrVerification(page) {
  const verification = page
    .getByText(/captcha|c[oó]digo de verificaci[oó]n|verifica tu identidad|autenticaci[oó]n de dos pasos|confirma que eres t[uú]/i)
    .filter({ visible: true }).first();
  const outcome = await Promise.race([
    page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: 180000 }).then(() => "storefront"),
    verification.waitFor({ timeout: 180000 }).then(() => "verification"),
    page.waitForTimeout(180000).then(() => "timeout"),
  ]);
  if (outcome === "verification") {
    console.log("[auth:login:co] Samsung Account requires human verification; complete it in the open Chrome window.");
    await page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout });
    return;
  }
  if (outcome !== "storefront") throw new Error(`Samsung Account did not return to the CO ${ENV_NAME} storefront within the allowed time.`);
}

async function hasVisibleCaptchaChallenge(page) {
  return page.evaluate(() => [...document.querySelectorAll("iframe")].some((frame) => {
    const title = frame.title || "";
    const bounds = frame.getBoundingClientRect();
    return /reCAPTCHA/i.test(title) && /desafio|challenge|expira|expires/i.test(title) && bounds.width > 0 && bounds.height > 0;
  }));
}

function writeJsonSecurely(destination, value) {
  writeJsonAtomically(destination, value);
}

async function exportAuthenticatedState(context, page) {
  const fullState = await context.storageState({ indexedDB: true });
  const coState = {
    cookies: fullState.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, "");
      return domain === HOSTNAME || domain === API_HOSTNAME ||
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
        await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      }
      if (!isCoStorefront(page)) {
        throw new Error(`CO S2 did not reach ${HOSTNAME}/co/. Complete WMC → Samsung Employees → AD SSO Login → QA / PreQA2 in the shared Chrome.`);
      }
      const profile = page.locator("button.nv00-gnb-v4__utility-user").filter({ visible: true }).first();
      await profile.waitFor({ state: "visible", timeout: 30000 });
      await profile.click();
      const login = page.locator("a.loginBtn").filter({ visible: true }).first();
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
  const credentials = manualLogin ? null : resolveRuntimeCredentials();
  const email = credentials?.email ?? null;
  const password = credentials?.password ?? null;
  const browser = await connectDedicatedChrome();
  const context = browser.contexts()[0];
  if (!context) throw new Error("Dedicated CO Chrome did not expose a browser context.");
  const existingAccountPage = context.pages().find((candidate) => {
    try { return new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
  });
  let page = existingAccountPage || await findRenderedCoPage(context) || context.pages().slice(-1)[0] || await context.newPage();
  let authenticated = false;
  page.setDefaultTimeout(120000);

  try {
    let menu;
    let menuState = "signed-out";
    let login;
    if (existingAccountPage) {
      console.log("[auth:login:co] resuming the existing Samsung Account tab in dedicated Chrome");
    } else {
      console.log(`[auth:login:co] opening CO ${ENV_NAME} storefront in dedicated Chrome`);
      page = await openCoHome(page, context);
      console.log(`[auth:login:co] CO ${ENV_NAME} My Profile is visible`);
      page = await openCoHome(page, context);
      ({ menu } = await waitForProfileMenu(page));
      console.log("[auth:login:co] CO profile menu is stable");
      login = menu.locator('a[data-an-la="login"]').filter({ visible: true });
      menuState = /Cerrar Sesi[oó]n/i.test(await menu.innerText()) ? "authenticated" : "signed-out";
    }
    if (menuState === "signed-out") {
      if (!existingAccountPage) {
        console.log("[auth:login:co] opening Samsung Account sign-in");
        const pagesBeforeLogin = new Set(context.pages());
        await login.click();
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
          if (currentMenu && /Cerrar Sesi[oó]n/i.test(await currentMenu.menu.innerText())) {
            console.log("[auth:login:co] storefront became authenticated without an account-page navigation");
            menuState = "authenticated";
          } else {
            throw new Error("Samsung Account sign-in did not open in the current tab or a new tab within 60 seconds.");
          }
        } else {
          page = accountCandidate;
        }
      }
      if (menuState === "signed-out") assertAllowedHost(page, [ACCOUNT_HOSTNAME], "Samsung Account login");

      if (menuState === "signed-out" && manualLogin) {
        console.log(`[auth:login:co] Samsung Account login is ready in the visible Chrome. Complete login/CAPTCHA/MFA manually; automation will resume after the authenticated CO ${ENV_NAME} return.`);
        const returnedPage = await Promise.race([
          page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout }).then(() => page),
          context.waitForEvent("page", { timeout: interactiveTimeout }).then(async (candidate) => {
            await candidate.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout });
            return candidate;
          }),
        ]);
        page = returnedPage;
      } else if (menuState === "signed-out") {
        const emailInput = page.locator('input#account');
        const passwordInput = page.locator('input[type="password"]').first();
        let emailStepComplete = false;
        if (!(await hasVisibleCaptchaChallenge(page))) await emailInput.fill(email);
        for (let attempt = 1; attempt <= 2 && !(await hasVisibleCaptchaChallenge(page)); attempt += 1) {
          const nextButton = page.getByRole("button", { name: /^Siguiente$/i });
          if (!(await nextButton.isEnabled())) break;
          if (await hasVisibleCaptchaChallenge(page)) break;
          await nextButton.click({ timeout: 10000 });
          emailStepComplete = await passwordInput.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
          if (emailStepComplete) break;
          if (!(await emailInput.isVisible().catch(() => false))) break;
        }
        if (!emailStepComplete) {
          if (await hasVisibleCaptchaChallenge(page)) {
            console.log("[auth:login:co] CAPTCHA is visible in the dedicated Chrome. Complete it manually and click Siguiente; automation will resume at the password step.");
            await passwordInput.waitFor({ state: "visible", timeout: interactiveTimeout });
            emailStepComplete = true;
          } else {
            throw new Error("Samsung Account did not advance from the email step to a password field; inspect the visible account page before retrying login.");
          }
        }
        console.log("[auth:login:co] Samsung Account password step is visible");
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 35 });
        await passwordInput.press("Tab");
        await page.getByRole("button", { name: /^Iniciar sesi[oó]n$/i }).click();
        console.log("[auth:login:co] Samsung Account password step completed");
        await waitForStorefrontOrVerification(page);
      }
    }

    console.log("[auth:login:co] validating authenticated storefront after return");
    let authenticatedMenu = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      page = await openCoHome(page, context);
      const menuResult = await waitForProfileMenu(page).catch(() => null);
      if (menuResult && /Cerrar Sesi[oó]n/i.test(await menuResult.menu.innerText())) {
        menu = menuResult.menu;
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
    authenticated = true;
  } finally {
    if (authenticated) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

(ENV_NAME === "S2" && HOSTNAME === "p6-pre-qa2.samsung.com"
  ? loginCoPreQa2SharedChrome()
  : loginCoSamsungAccount()).catch((error) => {
  const summary = String(error.message || "unknown error").split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:login:co] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
