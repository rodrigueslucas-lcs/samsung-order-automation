const { chromium } = require("@playwright/test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const HOSTNAME = "stg.shop.samsung.com";
const ACCOUNT_HOSTNAME = "account.samsung.com";
const setupUrl = `https://${HOSTNAME}/getcookie.html`;
const homeUrl = `https://${HOSTNAME}/mx/`;
const profileDir = path.resolve("playwright/profiles/s1-mx-qa");
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, "mx-s1-user.json");
const sessionStorageFile = path.join(authDir, "mx-s1-session-storage.json");
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");
const interactiveTimeout = Number(process.env.MX_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
const manualLogin = process.env.MX_AUTH_MANUAL === "1";

function requiredRuntimeSecret(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required at runtime.`);
  return value;
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) {
    return null;
  }
  const port = Number(fs.readFileSync(devToolsActivePortFile, "utf8").split(/\r?\n/)[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return port;
}

async function connectDedicatedChrome() {
  const existingPort = readDevToolsPort();
  if (existingPort) {
    const existing = await chromium
      .connectOverCDP(`http://127.0.0.1:${existingPort}`)
      .catch(() => null);
    if (existing) return existing;
  }

  fs.rmSync(devToolsActivePortFile, { force: true });
  const launcher = spawnSync(process.execPath, [path.resolve("scripts/auth-open-profile-mx.cjs")], {
    stdio: "inherit",
  });
  if (launcher.status !== 0) {
    throw new Error("Dedicated MX Chrome could not be launched automatically.");
  }

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const port = readDevToolsPort();
    if (port) {
      const browser = await chromium
        .connectOverCDP(`http://127.0.0.1:${port}`)
        .catch(() => null);
      if (browser) return browser;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Dedicated MX Chrome did not expose CDP within 30 seconds.");
}

function assertAllowedHost(page, allowed, step) {
  if (!allowed.includes(new URL(page.url()).hostname)) {
    throw new Error(`${step} reached an unexpected host.`);
  }
}

async function waitForProfileMenu(page) {
  const profile = page.getByRole("button", { name: "My Profile", exact: true });
  await profile.waitFor({ state: "visible", timeout: 120000 });
  await profile.hover();
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('[role="menu"].profile-menu')].some(
      (current) =>
        current.offsetParent !== null &&
        !current.classList.contains("mat-menu-panel-animating") &&
        /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i.test(current.innerText)
    );
  }, null, { timeout: 30000 });
  const menu = page
    .locator('[role="menu"].profile-menu')
    .filter({ hasText: /Cerrar Sesi[oó]n|Iniciar Sesi[oó]n/i })
    .filter({ visible: true })
    .last();
  await menu.waitFor({ state: "visible", timeout: 30000 });
  return { profile, menu };
}

async function openMxHome(page) {
  await page.goto(setupUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assertAllowedHost(page, [HOSTNAME], "MX setup");
  await page.getByText(/You can access pages now/i).waitFor({ timeout: 60000 });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    assertAllowedHost(page, [HOSTNAME], "MX storefront");
    const ready = await page
      .getByRole("button", { name: "My Profile", exact: true })
      .waitFor({ state: "visible", timeout: 120000 })
      .then(() => true)
      .catch(() => false);
    if (ready) return;
    if (attempt === 3) throw new Error("MX S1 storefront did not render My Profile after 3 navigation attempts.");
  }
}

async function waitForStorefrontOrVerification(page) {
  const verification = page
    .getByText(/captcha|c[oó]digo de verificaci[oó]n|verifica tu identidad|autenticaci[oó]n de dos pasos|confirma que eres t[uú]/i)
    .filter({ visible: true })
    .first();
  const outcome = await Promise.race([
    page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: 180000 }).then(() => "storefront"),
    verification.waitFor({ timeout: 180000 }).then(() => "verification"),
    page.waitForTimeout(180000).then(() => "timeout"),
  ]);

  if (outcome === "verification") {
    console.log("[auth:login:mx] Samsung Account requires human verification; complete it in the open Chrome window.");
    await page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout });
    return;
  }
  if (outcome !== "storefront") {
    throw new Error("Samsung Account did not return to the MX S1 storefront within the allowed time.");
  }
}

function writeJsonSecurely(destination, value) {
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, destination);
}

async function exportAuthenticatedState(context, page) {
  const fullState = await context.storageState({ indexedDB: true });
  const mxState = {
    cookies: fullState.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, "");
      return domain === HOSTNAME || cookie.domain === ".samsung.com";
    }),
    origins: fullState.origins.filter(({ origin }) => new URL(origin).hostname === HOSTNAME),
  };
  if (!mxState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === HOSTNAME)) {
    throw new Error("No MX S1 storefront cookies were available after login.");
  }
  const sessionStorage = await page.evaluate(() =>
    Object.fromEntries(
      Array.from({ length: window.sessionStorage.length }, (_, index) => {
        const key = window.sessionStorage.key(index);
        return [key, window.sessionStorage.getItem(key)];
      }).filter(([key]) => key !== null)
    )
  );
  fs.mkdirSync(authDir, { recursive: true });
  writeJsonSecurely(authFile, mxState);
  writeJsonSecurely(sessionStorageFile, sessionStorage);
}

async function loginMxSamsungAccount() {
  const email = manualLogin ? null : requiredRuntimeSecret("MX_SAMSUNG_EMAIL");
  const password = manualLogin ? null : requiredRuntimeSecret("MX_SAMSUNG_PASSWORD");
  const browser = await connectDedicatedChrome();
  const context = browser.contexts()[0];
  if (!context) throw new Error("Dedicated MX Chrome did not expose a browser context.");
  let page = await context.newPage();
  page.setDefaultTimeout(120000);

  try {
    console.log("[auth:login:mx] opening MX S1 storefront in dedicated Chrome");
    await openMxHome(page);
    console.log("[auth:login:mx] MX S1 My Profile is visible");
    let { menu } = await waitForProfileMenu(page);
    console.log("[auth:login:mx] MX profile menu is stable");
    const logout = menu.getByText(/^Cerrar Sesi[oó]n$/i);
    const login = menu.locator('a[data-an-la="login"]').filter({ visible: true });
    const menuText = await menu.innerText();
    const menuState = /Cerrar Sesi[oó]n/i.test(menuText) ? "authenticated" : "signed-out";
    if (menuState === "signed-out") {
      console.log("[auth:login:mx] opening Samsung Account sign-in");
      await login.click();
      await page.waitForURL((url) => url.hostname === ACCOUNT_HOSTNAME, { timeout: 60000 });
      assertAllowedHost(page, [ACCOUNT_HOSTNAME], "Samsung Account login");

      if (manualLogin) {
        console.log("[auth:login:mx] Samsung Account login is ready in the visible Chrome. Complete login/CAPTCHA/MFA manually; automation will resume after the authenticated MX S1 return.");
        const returnedPage = await Promise.race([
          page.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout }).then(() => page),
          context.waitForEvent("page", { timeout: interactiveTimeout }).then(async (candidate) => {
            await candidate.waitForURL((url) => url.hostname === HOSTNAME, { timeout: interactiveTimeout });
            return candidate;
          }),
        ]);
        page = returnedPage;
      } else {

        const emailInput = page.getByRole("textbox", { name: /Direcci[oó]n de correo/i }).first();
        await emailInput.click();
        await emailInput.pressSequentially(email, { delay: 35 });
        await emailInput.press("Tab");
        await page.getByRole("button", { name: /^Siguiente$/i }).click();
        console.log("[auth:login:mx] Samsung Account email step completed");

        const passwordInput = page.locator('input[type="password"]').first();
        await passwordInput.waitFor({ state: "visible", timeout: 60000 });
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 35 });
        await passwordInput.press("Tab");
        await page.getByRole("button", { name: /^Iniciar sesi[oó]n$/i }).click();
        console.log("[auth:login:mx] Samsung Account password step completed");
        await waitForStorefrontOrVerification(page);
      }
    }

    console.log("[auth:login:mx] validating authenticated storefront after return");
    await openMxHome(page);
    ({ menu } = await waitForProfileMenu(page));
    if (!/Cerrar Sesi[oó]n/i.test(await menu.innerText())) {
      throw new Error("MX S1 returned from Samsung Account without an authenticated profile menu.");
    }
    console.log("[auth:login:mx] authenticated MX profile menu validated");
    await exportAuthenticatedState(context, page);
    console.log("[auth:login:mx] ignored MX auth state exported successfully");
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

loginMxSamsungAccount().catch((error) => {
  const summary = String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:login:mx] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
