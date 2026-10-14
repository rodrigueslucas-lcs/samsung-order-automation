const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { getClQstConfig } = require("../config/markets/cl");
const { writeJsonAtomically } = require("../utils/atomicJson");
const { installClChatNoticeDismissal } = require("../utils/clStorefrontOverlays");
const { waitForClAuthenticatedReturn, assertClSsoConfiguration, validatedClSsoLoginUrl } = require("../utils/clAuthLoginReturn.cjs");

const config = getClQstConfig();
const slot = String(process.env.CL_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(slot)) throw new Error(`Unsupported CL auth slot: ${slot}.`);

const suffix = config.environment.toLowerCase();
const slotInfix = slot === "second" ? "-second" : "";
const authDir = path.resolve("playwright/.auth");
const profileDir = path.resolve(`playwright/profiles/${suffix}-cl-${slot === "second" ? "second" : "qa"}`);
const authFile = path.join(authDir, `cl-${suffix}${slotInfix}-user.json`);
const sessionStorageFile = path.join(authDir, `cl-${suffix}${slotInfix}-session-storage.json`);
const manual = process.env.CL_AUTH_MANUAL === "1";
const interactiveTimeout = Number(process.env.CL_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
const accountHostname = "account.samsung.com";

function readCredentials() {
  const candidates = slot === "second"
    ? ["cl-second-storefront-user.json", "co-second-storefront-user.json", "mx-second-storefront-user.json"]
    : ["samsung-storefront-user.json", "co-storefront-user.json", "mx-storefront-user.json"];
  let local = {};
  for (const name of candidates) {
    const file = path.join(authDir, name);
    if (!fs.existsSync(file)) continue;
    local = JSON.parse(fs.readFileSync(file, "utf8"));
    break;
  }
  const email = slot === "second"
    ? process.env.CL_SECOND_SAMSUNG_EMAIL?.trim() || local.email
    : process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.CL_SAMSUNG_EMAIL?.trim() || local.email;
  const password = slot === "second"
    ? process.env.CL_SECOND_SAMSUNG_PASSWORD || local.password
    : process.env.SAMSUNG_ACCOUNT_PASSWORD || process.env.CL_SAMSUNG_PASSWORD || local.password;
  return { email, password };
}

function profileButton(page) {
  return page.getByRole("button", { name: "My Profile", exact: true })
    .or(page.locator('button[data-an-la="L0_13_login"]'))
    .or(page.locator("button.nv00-gnb-v4__utility-user"))
    .filter({ visible: true }).first();
}

function accountActions(page) {
  const login = page
    .locator('a[data-an-la="login"], a.loginBtn')
    .or(page.getByRole("link", { name: /Iniciar Sesi[oó]n|Sign in/i }))
    .or(page.getByText(/^Iniciar Sesi[oó]n$|^Sign in$/i))
    .filter({ visible: true })
    .first();
  const logout = page
    .getByText(/Cerrar Sesi[oó]n|Sign out/i)
    .filter({ visible: true })
    .first();
  return { login, logout };
}

async function dismissNotificationTutorial(page) {
  const notice = page.getByText(/^¡Listo!$|^Got it$/i).filter({ visible: true }).first();
  if (!(await notice.isVisible().catch(() => false))) return;
  await notice.click({ timeout: 3000 }).catch(async () => {
    await notice.evaluate((element) => element.click()).catch(() => {});
  });
  await notice.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  console.log("[auth:login:cl] dismissed storefront notification tutorial");
}

async function maximizeClWindow(page) {
  await require("../utils/authBrowserWindow.cjs").prepareAuthBrowserWindow(page);
}

async function accountState(page) {
  await installClChatNoticeDismissal(page);
  await maximizeClWindow(page);
  await dismissNotificationTutorial(page);
  const profile = profileButton(page);
  await profile.waitFor({ state: "visible", timeout: 120000 });
  await page.bringToFront().catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await dismissNotificationTutorial(page);
    await page.mouse.move(0, 0);
    await profile.hover();
    const { login, logout } = accountActions(page);
    const waitForActions = (timeout) => Promise.any([
      logout.waitFor({ state: "visible", timeout }).then(() => "authenticated"),
      login.waitFor({ state: "visible", timeout }).then(() => "signed-out"),
    ]).catch(() => null);
    let state = await waitForActions(6000);
    if (!state) {
      await profile.click({ timeout: 10000 });
      state = await waitForActions(10000);
    }
    if (state) return { state, login, logout };
    if (attempt < 3) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(750);
    }
  }
  throw new Error("CL profile control is visible, but login/logout actions did not render after maximized hover/click retries.");
}

async function findAccountPage(context, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of context.pages().slice().reverse()) {
      if (candidate.isClosed()) continue;
      try {
        if (new URL(candidate.url()).hostname === accountHostname) return candidate;
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function openOfficialClLogin(page, ssoInfo, target) {
  const loginUrl = validatedClSsoLoginUrl(ssoInfo, target);
  await page.waitForFunction(() => typeof window.samsung?.account?.signIn === "function", null, { timeout: 30000 });
  // Match the storefront's IAM v3 service, including its SDK-managed return.
  // A direct navigation to signInGate skips that browser-side initialization.
  await page.evaluate(url => {
    const parameters = new URL(url).searchParams;
    window.samsung.account.signIn({
      clientId: parameters.get("client_id"),
      redirectUri: encodeURIComponent(parameters.get("redirect_uri")),
      responseType: parameters.get("response_type"),
      state: parameters.get("state"),
    }, { locale: `${parameters.get("locale").split("_")[0]}-${parameters.get("countryCode")}` });
  }, loginUrl);
}

async function exportState(context, page) {
  const full = await context.storageState({ indexedDB: true });
  const hostname = config.baseUrl.hostname;
  const filtered = {
    cookies: full.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, "");
      return domain === hostname || cookie.domain === ".samsung.com" || ["account.samsung.com", "sts.secsso.net", "wds.samsung.com"].includes(domain);
    }),
    origins: full.origins.filter(({ origin }) => new URL(origin).hostname === hostname),
  };
  const sessionStorage = await page.evaluate(() => Object.fromEntries(
    Array.from({ length: window.sessionStorage.length }, (_, index) => {
      const key = window.sessionStorage.key(index);
      return [key, key === null ? null : window.sessionStorage.getItem(key)];
    }).filter(([key]) => key !== null)
  ));
  fs.mkdirSync(authDir, { recursive: true });
  writeJsonAtomically(authFile, filtered);
  writeJsonAtomically(sessionStorageFile, sessionStorage);
  console.log(`[auth:login:cl] exported ${config.environment} ${slot} session -> ${authFile}`);
}

(async () => {
  fs.mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--disable-background-mode", "--hide-crash-restore-bubble"],
  });
  let page = context.pages()[0] || await context.newPage();
  const observePage = candidate => {
    candidate.on("response", async response => {
      const url = new URL(response.url());
      if (url.hostname === config.baseUrl.hostname && /^\/cl\/login\//.test(url.pathname)) {
        console.log(`[auth:login:cl] SSO callback: HTTP ${response.status()} ${url.pathname}`);
        const headers = await response.headersArray().catch(() => []);
        const cookieNames = headers.filter(header => header.name.toLowerCase() === "set-cookie")
          .map(header => header.value.split("=", 1)[0]).filter(name => /^[A-Za-z0-9_-]+$/.test(name));
        console.log(`[auth:login:cl] SSO callback cookie names only: ${cookieNames.join(",") || "none"}`);
        const location = await response.headerValue("location").catch(() => null);
        if (location) {
          const destination = new URL(location, url);
          console.log(`[auth:login:cl] SSO redirect: ${destination.hostname}${destination.pathname}; parameter names: ${[...destination.searchParams.keys()].join(",") || "none"}`);
        }
      }
      if (url.hostname.endsWith(".ecom-stg.samsung.com") && /\/(?:currentConfig|users\/current|token)$/.test(url.pathname)) {
        console.log(`[auth:login:cl] storefront auth service: HTTP ${response.status()} ${url.pathname}`);
      }
    });
    candidate.on("framenavigated", frame => {
      if (frame !== candidate.mainFrame()) return;
      const url = new URL(frame.url());
      if (url.hostname === config.baseUrl.hostname && /^\/cl(?:\/|$)/.test(url.pathname)) {
        console.log(`[auth:login:cl] storefront return: ${url.pathname}`);
      }
    });
  };
  context.pages().forEach(observePage);
  context.on("page", observePage);
  try {
    console.log(`[auth:login:cl] ${config.environment} ${slot}: Chrome opened; preparing storefront`);
    await installClChatNoticeDismissal(page);
    page.setDefaultTimeout(120000);
    if (config.setupUrl) {
      await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByText(/You can access pages now/i).waitFor({ timeout: 60000 });
    }
    const configuration = page.waitForResponse(response => {
      return new URL(response.url()).pathname.endsWith("/v2/cl/currentConfig");
    }, { timeout: 30000 }).then(async response => {
      const body = await response.json().catch(() => ({}));
      return { status: response.status(), errorType: body.errors?.[0]?.type };
    }).catch(() => null);
    const ssoInfo = page.waitForResponse(response => {
      return new URL(response.url()).pathname.endsWith("/v2/cl/ssoInfo");
    }, { timeout: 30000 }).then(response => response.ok() ? response.json() : null).catch(() => null);
    await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("[auth:login:cl] storefront loaded; maximizing and checking profile actions");
    await dismissNotificationTutorial(page);
    let state = await accountState(page);
    console.log(`[auth:login:cl] storefront profile state: ${state.state}`);

    if (state.state !== "authenticated") {
      const observedConfiguration = await configuration;
      let observedSso = await ssoInfo;
      if (!observedSso?.ssoLoginUrl) {
        const api = `https://${suffix}-smb-api-cdn.ecom-stg.samsung.com`;
        const response = await context.request.get(`${api}/tokocommercewebservices/v2/cl/ssoInfo`, {
          params: { page: "homepage", lang: "es_CL", curr: "CLP" },
          timeout: 30000,
        });
        console.log(`[auth:login:cl] official CL ssoInfo bootstrap: HTTP ${response.status()}`);
        if (response.ok()) observedSso = await response.json();
      }
      const ssoTarget = { hostname: config.baseUrl.hostname, environment: config.environment };
      assertClSsoConfiguration(observedConfiguration, observedSso, ssoTarget);
      const credentials = manual ? null : readCredentials();
      if (!manual && (!credentials.email || !credentials.password)) {
        throw new Error(slot === "second"
          ? "CL second-account credentials are unavailable. Configure CL_SECOND_SAMSUNG_EMAIL/CL_SECOND_SAMSUNG_PASSWORD or use CL_AUTH_MANUAL=1."
          : "Global Samsung Account credentials are unavailable. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or playwright/.auth/samsung-storefront-user.json.");
      }

      let accountPage;
      if (observedConfiguration?.status >= 400) {
        console.log("[auth:login:cl] home configuration is degraded; opening the official CL IAM SDK login supplied by ssoInfo");
        await openOfficialClLogin(page, observedSso, ssoTarget);
        accountPage = await findAccountPage(context, 15000);
      } else {
        console.log("[auth:login:cl] opening Samsung Account from the profile menu");
        await state.login.click({ timeout: 10000 });
        accountPage = await findAccountPage(context, 15000);
        if (!accountPage && new URL(page.url()).hostname === config.baseUrl.hostname && (await accountState(page)).state !== "authenticated") {
          console.log("[auth:login:cl] profile action did not navigate; using the validated backend CL login URL");
          await openOfficialClLogin(page, observedSso, ssoTarget);
          accountPage = await findAccountPage(context, 15000);
        }
      }
      console.log(`[auth:login:cl] Samsung Account tab ${accountPage ? "detected" : "not detected; checking storefront return"}`);
      if (!accountPage && (await accountState(page)).state !== "authenticated") {
        const error = new Error("CL profile login action did not open Samsung Account or authenticate the storefront. Check the staging SSO configuration; no credentials were submitted.");
        error.exitCode = 78;
        throw error;
      }
      if (accountPage) {
        page = accountPage;
        page.setDefaultTimeout(120000);
        await maximizeClWindow(page);
      }

      if (manual) {
        console.log("[auth:login:cl] Complete Samsung Account login/CAPTCHA/MFA manually in the opened browser.");
      } else if (new URL(page.url()).hostname === accountHostname) {
        console.log("[auth:login:cl] Samsung Account: completing configured login; CAPTCHA/MFA remains manual if requested");
        const emailInput = page.locator('input#account, input[type="email"], input[name="userId"], input[name="email"]').filter({ visible: true }).first();
        await emailInput.waitFor({ state: "visible", timeout: 60000 });
        await emailInput.fill(credentials.email);
        const next = page.getByRole("button", { name: /Siguiente|Continuar|Next|Sign in/i }).filter({ visible: true }).first();
        if (await next.isVisible().catch(() => false)) await next.click();
        const passwordInput = page.locator('input[type="password"]').filter({ visible: true }).first();
        const passwordReady = await passwordInput.waitFor({ state: "visible", timeout: 15000 }).then(() => true, () => false);
        if (!passwordReady) {
          const captcha = await page.locator('iframe[title*="reCAPTCHA"]').evaluateAll(frames => frames.some(frame => {
            const bounds = frame.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
          }));
          if (!captcha) throw new Error("Samsung Account did not show the password step after email submission; inspect the login window.");
          if (process.env.CI) throw new Error("Samsung Account requires a human CAPTCHA; CI cannot complete this verification.");
          await page.bringToFront();
          console.log("[auth:login:cl] CAPTCHA visible. Complete it in this Chrome window and click Siguiente; the refresh will continue automatically.");
          await passwordInput.waitFor({ state: "visible", timeout: interactiveTimeout });
        }
        await passwordInput.fill(credentials.password);
        const signIn = page.getByRole("button", { name: /Iniciar sesi[oó]n|Sign in|Continuar/i }).filter({ visible: true }).last();
        await signIn.click();
      }

      console.log("[auth:login:cl] waiting for authenticated CL return; leaving the login window intact");
      page = await waitForClAuthenticatedReturn(context, {
        hostname: config.baseUrl.hostname,
        accountPage,
        readAccountState: accountState,
        timeout: interactiveTimeout,
      });
    }

    await exportState(context, page);
  } finally {
    await context.close();
  }
})().catch((error) => {
  if (/Opening in existing browser session|ProcessSingleton|profile.*already in use/i.test(String(error.message))) {
    console.error("[auth:login:cl] Dedicated CL profile is already in use. Finish/close its current refresh before starting another; no session files were removed.");
    process.exitCode = 73;
  } else {
    const message = String(error.message).split("\n", 1)[0].replace(/https:\/\/account\.samsung\.com\/\S+/g, "https://account.samsung.com/[redacted]");
    console.error(`[auth:login:cl] ${message}`);
    process.exitCode = error.exitCode || 1;
  }
});
