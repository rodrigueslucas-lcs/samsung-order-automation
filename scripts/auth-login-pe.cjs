const { chromium } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const path = require("node:path");
const { getPeQstConfig } = require("../config/markets/pe");

const CONFIG = getPeQstConfig();
const HOSTNAME = CONFIG.baseUrl.hostname;
const API_HOSTNAME = "pe-smb-api-cdn.ecom-stg.samsung.com";
const ENV_NAME = CONFIG.environment;
const ENV_SUFFIX = ENV_NAME.toLowerCase();
const ACCOUNT_HOSTNAME = "account.samsung.com";
const setupUrl = CONFIG.setupUrl?.href || `https://${HOSTNAME}/getcookie.html`;
const homeUrl = CONFIG.baseUrl.href;
const profileDir = path.resolve(`playwright/profiles/${ENV_SUFFIX}-pe-qa`);
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, `pe-${ENV_SUFFIX}-user.json`);
const sessionStorageFile = path.join(authDir, `pe-${ENV_SUFFIX}-session-storage.json`);
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");
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
  const launcher = spawnSync(process.execPath, [path.resolve("scripts/auth-open-profile-pe.cjs")], {
    stdio: "inherit",
  });
  if (launcher.status !== 0) throw new Error("Dedicated PE Chrome could not be launched automatically.");

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const port = readDevToolsPort();
    if (port) {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
      if (browser) return browser;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Dedicated PE Chrome did not expose CDP within 30 seconds.");
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
  return page.getByRole("button", { name: "My Profile", exact: true })
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
  }, null, { timeout: 30000 });
  const menu = page.locator('[role="menu"].profile-menu')
    .filter({ hasText: /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i })
    .filter({ visible: true })
    .last();
  await menu.waitFor({ state: "visible", timeout: 30000 });
  return { profile, menu };
}

async function openPeHome(page, context) {
  const renderedBeforeNavigation = await findRenderedPePage(context, page);
  if (renderedBeforeNavigation) {
    console.log(`[auth:login:pe] reusing an already rendered PE ${ENV_NAME} storefront tab`);
    return renderedBeforeNavigation;
  }

  await page.goto(setupUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assertAllowedHost(page, [HOSTNAME], "PE setup");
  await page.getByText(/You can access pages now/i).waitFor({ timeout: 60000 });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    assertAllowedHost(page, [HOSTNAME], "PE storefront");
    if (await hasRenderedStorefront(page, 30000)) return page;

    const renderedSibling = await findRenderedPePage(context);
    if (renderedSibling) {
      console.log("[auth:login:pe] current PE tab is blank; switching to a rendered sibling PE tab");
      return renderedSibling;
    }
    if (attempt < 3) await page.waitForTimeout(3000);
  }
  throw new Error(`PE ${ENV_NAME} storefront did not render My Profile after 3 navigation attempts and no rendered sibling tab was available.`);
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
    console.log("[auth:login:pe] Samsung Account requires human verification; complete it in the open Chrome window.");
    await page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout });
    return;
  }
  if (outcome !== "storefront") throw new Error(`Samsung Account did not return to the PE ${ENV_NAME} storefront within the allowed time.`);
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
  const peState = {
    cookies: fullState.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, "");
      return domain === HOSTNAME || domain === API_HOSTNAME || cookie.domain === ".samsung.com";
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
  const credentials = manualLogin ? null : resolveRuntimeCredentials();
  const email = credentials?.email ?? null;
  const password = credentials?.password ?? null;
  const browser = await connectDedicatedChrome();
  const context = browser.contexts()[0];
  if (!context) throw new Error("Dedicated PE Chrome did not expose a browser context.");
  const existingAccountPage = context.pages().find((candidate) => {
    try { return new URL(candidate.url()).hostname === ACCOUNT_HOSTNAME; } catch { return false; }
  });
  let page = existingAccountPage || await findRenderedPePage(context) || await context.newPage();
  let authenticated = false;
  page.setDefaultTimeout(120000);

  try {
    let menu;
    let menuState = "signed-out";
    let login;
    if (existingAccountPage) {
      console.log("[auth:login:pe] resuming the existing Samsung Account tab in dedicated Chrome");
    } else {
      console.log(`[auth:login:pe] opening PE ${ENV_NAME} storefront in dedicated Chrome`);
      page = await openPeHome(page, context);
      console.log(`[auth:login:pe] PE ${ENV_NAME} My Profile is visible`);
      page = await openPeHome(page, context);
      ({ menu } = await waitForProfileMenu(page));
      console.log("[auth:login:pe] PE profile menu is stable");
      login = menu.locator('a[data-an-la="login"]').filter({ visible: true });
      menuState = /Cerrar Sesi[oó]n/i.test(await menu.innerText()) ? "authenticated" : "signed-out";
    }
    if (menuState === "signed-out") {
      if (!existingAccountPage) {
        console.log("[auth:login:pe] opening Samsung Account sign-in");
        await login.click();
        await page.waitForURL((url) => url.hostname === ACCOUNT_HOSTNAME, { timeout: 60000 });
      }
      assertAllowedHost(page, [ACCOUNT_HOSTNAME], "Samsung Account login");

      if (manualLogin) {
        console.log(`[auth:login:pe] Samsung Account login is ready in the visible Chrome. Complete login/CAPTCHA/MFA manually; automation will resume after the authenticated PE ${ENV_NAME} return.`);
        const returnedPage = await Promise.race([
          page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout }).then(() => page),
          context.waitForEvent("page", { timeout: interactiveTimeout }).then(async (candidate) => {
            await candidate.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout });
            return candidate;
          }),
        ]);
        page = returnedPage;
      } else {
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
            console.log("[auth:login:pe] CAPTCHA is visible in the dedicated Chrome. Complete it manually and click Siguiente; automation will resume at the password step.");
            await passwordInput.waitFor({ state: "visible", timeout: interactiveTimeout });
            emailStepComplete = true;
          } else {
            throw new Error("Samsung Account did not advance from the email step to a password field; inspect the visible account page before retrying login.");
          }
        }
        console.log("[auth:login:pe] Samsung Account password step is visible");
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 35 });
        await passwordInput.press("Tab");
        await page.getByRole("button", { name: /^Iniciar sesi[oó]n$/i }).click();
        console.log("[auth:login:pe] Samsung Account password step completed");
        await waitForStorefrontOrVerification(page);
      }
    }

    console.log("[auth:login:pe] validating authenticated storefront after return");
    page = await openPeHome(page, context);
    page = await openPeHome(page, context);
    ({ menu } = await waitForProfileMenu(page));
    if (!/Cerrar Sesi[oó]n/i.test(await menu.innerText())) {
      throw new Error(`PE ${ENV_NAME} returned from Samsung Account without an authenticated profile menu.`);
    }
    console.log("[auth:login:pe] authenticated PE profile menu validated");
    await exportAuthenticatedState(context, page);
    console.log("[auth:login:pe] ignored PE auth state exported successfully");
    authenticated = true;
  } finally {
    if (authenticated) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

loginPeSamsungAccount().catch((error) => {
  const summary = String(error.message || "unknown error").split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:login:pe] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
