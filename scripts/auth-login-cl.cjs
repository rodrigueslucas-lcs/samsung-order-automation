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

function readCredentials() {
  const candidates = slot === "second"
    ? ["cl-second-storefront-user.json", "mx-second-storefront-user.json", "co-second-storefront-user.json"]
    : ["samsung-storefront-user.json", "mx-storefront-user.json", "co-storefront-user.json"];
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

async function accountState(page) {
  const profile = profileButton(page);
  await profile.waitFor({ state: "visible", timeout: 60000 });
  await profile.click().catch(() => {});
  const logout = page.getByText(/Cerrar Sesi[oó]n/i).filter({ visible: true }).first();
  const login = page.getByText(/^Iniciar Sesi[oó]n$/i).filter({ visible: true }).first();
  if (await logout.isVisible().catch(() => false)) return { state: "authenticated", logout, login };
  if (await login.isVisible().catch(() => false)) return { state: "signed-out", logout, login };
  await Promise.race([
    logout.waitFor({ state: "visible", timeout: 10000 }),
    login.waitFor({ state: "visible", timeout: 10000 }),
  ]).catch(() => {});
  if (await logout.isVisible().catch(() => false)) return { state: "authenticated", logout, login };
  return { state: "signed-out", logout, login };
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
  const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
  let page = context.pages()[0] || await context.newPage();
  try {
    if (config.setupUrl) {
      await page.goto(config.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByText(/You can access pages now/i).waitFor({ timeout: 60000 }).catch(() => {});
    }
    await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    let state = await accountState(page);
    if (state.state !== "authenticated") {
      if (!manual) {
        const { email, password } = readCredentials();
        if (!email || !password) {
          throw new Error(slot === "second"
            ? "CL second-account credentials are unavailable. Configure CL_SECOND_SAMSUNG_EMAIL/CL_SECOND_SAMSUNG_PASSWORD or use CL_AUTH_MANUAL=1."
            : "Global Samsung Account credentials are unavailable. Configure SAMSUNG_ACCOUNT_EMAIL/SAMSUNG_ACCOUNT_PASSWORD or playwright/.auth/samsung-storefront-user.json.");
        }
      }
      await state.login.click();
      await page.waitForURL((url) => url.hostname === "account.samsung.com" || url.hostname === config.baseUrl.hostname, { timeout: 60000 });
      if (page.url().includes("account.samsung.com") && !manual) {
        const { email, password } = readCredentials();
        const emailInput = page.locator('input[type="email"], input[name="userId"], input[name="email"]').filter({ visible: true }).first();
        await emailInput.fill(email);
        const next = page.getByRole("button", { name: /Siguiente|Continuar|Next|Sign in/i }).filter({ visible: true }).first();
        if (await next.isVisible().catch(() => false)) await next.click();
        const passwordInput = page.locator('input[type="password"]').filter({ visible: true }).first();
        await passwordInput.waitFor({ state: "visible", timeout: 60000 });
        await passwordInput.fill(password);
        const signIn = page.getByRole("button", { name: /Iniciar sesi[oó]n|Sign in|Continuar/i }).filter({ visible: true }).last();
        await signIn.click();
      } else if (manual) {
        console.log("[auth:login:cl] Complete Samsung Account login/CAPTCHA/MFA manually in the opened browser.");
      }
      await page.waitForURL((url) => url.hostname === config.baseUrl.hostname, { timeout: interactiveTimeout });
      await page.goto(config.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
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
