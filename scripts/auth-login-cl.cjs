const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { getClQstConfig } = require("../config/markets/cl");
const { writeJsonAtomically } = require("../utils/atomicJson");

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

async function accountState(page) {
  await dismissNotificationTutorial(page);
  const profile = profileButton(page);
  await profile.waitFor({ state: "visible", timeout: 120000 });
  await page.bringToFront().catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await dismissNotificationTutorial(page);
    await profile.hover().catch(() => {});
    await profile.click({ timeout: 10000 }).catch(() => {});
    const { login, logout } = accountActions(page);
    const state = await Promise.any([
      logout.waitFor({ state: "visible", timeout: attempt === 1 ? 6000 : 10000 }).then(() => "authenticated"),
      login.waitFor({ state: "visible", timeout: attempt === 1 ? 6000 : 10000 }).then(() => "signed-out"),
    ]).catch(() => null);
    if (state) return { state, login, logout };
    if (attempt < 3) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(750);
    }
  }
  throw new Error("CL profile control is visible, but login/logout actions did not render after click retries.");
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
    args: ["--start-maximized", "--disable-background-mode"],
  });
  let page = context.pages()[0] || await context.newPage();
  try {
    page.setDefaultTimeout(120000);
    if (config.setupUrl) {
      await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByText(/You can access pages now/i).waitFor({ timeout: 60000 });
    }
    await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dismissNotificationTutorial(page);
    let state = await accountState(page);

    if (state.state !== "authenticated") {
      const credentials = manual ? null : readCredentials();
      if (!manual && (!credentials.email || !credentials.password)) {
        throw new Error(slot === "second"
          ? "CL second-account credentials are unavailable. Configure CL_SECOND_SAMSUNG_EMAIL/CL_SECOND_SAMSUNG_PASSWORD or use CL_AUTH_MANUAL=1."
          : "Global Samsung Account credentials are unavailable. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or playwright/.auth/samsung-storefront-user.json.");
      }

      await state.login.click({ timeout: 10000 }).catch(async () => {
        await state.login.evaluate((element) => element.click());
      });

      const accountPage = await findAccountPage(context, 60000);
      if (accountPage) {
        page = accountPage;
        page.setDefaultTimeout(120000);
      }

      if (manual) {
        console.log("[auth:login:cl] Complete Samsung Account login/CAPTCHA/MFA manually in the opened browser.");
      } else if (new URL(page.url()).hostname === accountHostname) {
        const emailInput = page.locator('input#account, input[type="email"], input[name="userId"], input[name="email"]').filter({ visible: true }).first();
        await emailInput.waitFor({ state: "visible", timeout: 60000 });
        await emailInput.fill(credentials.email);
        const next = page.getByRole("button", { name: /Siguiente|Continuar|Next|Sign in/i }).filter({ visible: true }).first();
        if (await next.isVisible().catch(() => false)) await next.click();
        const passwordInput = page.locator('input[type="password"]').filter({ visible: true }).first();
        await passwordInput.waitFor({ state: "visible", timeout: 60000 });
        await passwordInput.fill(credentials.password);
        const signIn = page.getByRole("button", { name: /Iniciar sesi[oó]n|Sign in|Continuar/i }).filter({ visible: true }).last();
        await signIn.click();
      }

      const deadline = Date.now() + interactiveTimeout;
      let storefrontPage = null;
      while (Date.now() < deadline) {
        storefrontPage = context.pages().find((candidate) => {
          try {
            const url = new URL(candidate.url());
            return url.hostname === config.baseUrl.hostname && (url.pathname === "/cl" || url.pathname.startsWith("/cl/"));
          } catch { return false; }
        });
        if (storefrontPage) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!storefrontPage) throw new Error(`Samsung Account did not return to the CL ${config.environment} storefront within the allowed time.`);
      page = storefrontPage;
      await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await dismissNotificationTutorial(page);
      state = await accountState(page);
      if (state.state !== "authenticated") throw new Error(`CL ${config.environment} Samsung Account login did not become authenticated.`);
    }

    await exportState(context, page);
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(`[auth:login:cl] ${error.message}`);
  process.exitCode = 1;
});
