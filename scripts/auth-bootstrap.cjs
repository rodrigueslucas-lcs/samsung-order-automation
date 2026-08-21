const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const setupUrl = "https://stg2.shop.samsung.com/getcookie.html";
const homeUrl = "https://stg2.shop.samsung.com/pe/";
const profileDir = path.resolve("playwright/profiles/st2-peru-qa");
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, "user.json");
const authTempFile = path.join(authDir, "user.json.tmp");
const sessionStorageFile = path.join(authDir, "session-storage.json");
const sessionStorageTempFile = path.join(authDir, "session-storage.json.tmp");
const devToolsActivePortFile = path.join(profileDir, "DevToolsActivePort");

let currentStep = "starting export";

function reportStep(message) {
  currentStep = message;
  console.log(`[auth:export] ${message}`);
}

function safeErrorSummary(error) {
  return String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
}

function readDevToolsPort() {
  if (!fs.existsSync(devToolsActivePortFile)) {
    throw new Error(
      "the dedicated Chrome is not available for live export; run npm run auth:open-profile"
    );
  }

  const [portText] = fs.readFileSync(devToolsActivePortFile, "utf8").split("\n");
  const port = Number(portText);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("the dedicated Chrome debugging endpoint is invalid");
  }

  return port;
}

async function openProfileMenu(page) {
  const profileButton = page.getByRole("button", {
    name: "My Profile",
    exact: true,
  });

  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  reportStep("My Profile is visible");
  await profileButton.click();

  const menus = page.getByRole("menu").filter({ visible: true });
  const leafMenus = menus.filter({ hasNot: page.getByRole("menu") });

  reportStep("waiting for the visible leaf profile menu");
  await leafMenus.waitFor({ state: "visible", timeout: 30000 });

  const authenticatedMenu = leafMenus.filter({
    has: page.getByText("Cerrar sesión", { exact: true }),
  });

  if (!(await authenticatedMenu.isVisible())) {
    throw new Error(
      "the profile menu is open but ST2 is signed out; keep Chrome open after manual login and export from the live session"
    );
  }

  const menu = authenticatedMenu;
  const logout = menu.getByText("Cerrar sesión", { exact: true });

  await menu
    .locator(".mat-menu-panel-animating")
    .waitFor({ state: "detached", timeout: 30000 });

  reportStep("authenticated profile menu is open");

  return { logout, menu };
}

async function bootstrapAuthentication() {
  fs.mkdirSync(authDir, { recursive: true });

  reportStep("connecting to the live dedicated QA Chrome");
  const devToolsPort = readDevToolsPort();
  const browser = await chromium.connectOverCDP(
    `http://127.0.0.1:${devToolsPort}`
  );
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error("the dedicated Chrome did not expose its browser context");
  }

  const page = await context.newPage();

  try {
    reportStep("live dedicated QA Chrome connected");

    reportStep("opening ST2 cookie setup");
    await page.goto(setupUrl, { waitUntil: "domcontentloaded" });
    await page
      .getByText(/You can access pages now/i)
      .waitFor({ state: "visible", timeout: 60000 });
    reportStep("ST2 cookie setup completed");

    reportStep("opening ST2 Peru Home");
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

    const { logout } = await openProfileMenu(page);
    await logout.waitFor({ state: "visible", timeout: 30000 });
    reportStep("Cerrar sesión validated");

    reportStep("collecting ST2 storage state");
    const fullState = await context.storageState({
      indexedDB: true,
    });

    const st2State = {
      cookies: fullState.cookies.filter((cookie) => {
        const domain = cookie.domain.replace(/^\./, "");
        return (
          domain === "stg2.shop.samsung.com" ||
          cookie.domain === ".samsung.com"
        );
      }),
      origins: fullState.origins.filter(
        ({ origin }) => new URL(origin).hostname === "stg2.shop.samsung.com"
      ),
    };

    if (st2State.cookies.length === 0) {
      throw new Error("No ST2 cookies were available for export.");
    }

    const st2SessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );

    fs.writeFileSync(authTempFile, JSON.stringify(st2State, null, 2), {
      mode: 0o600,
    });
    fs.chmodSync(authTempFile, 0o600);

    fs.writeFileSync(
      sessionStorageTempFile,
      JSON.stringify(st2SessionStorage, null, 2),
      { mode: 0o600 }
    );
    fs.chmodSync(sessionStorageTempFile, 0o600);

    fs.renameSync(authTempFile, authFile);
    fs.renameSync(sessionStorageTempFile, sessionStorageFile);

    reportStep("ST2 auth state exported to playwright/.auth");
    console.log("[auth:export] ST2 and required parent-domain state exported; identity-provider and third-party state excluded");
  } finally {
    if (fs.existsSync(authTempFile)) {
      fs.unlinkSync(authTempFile);
    }
    if (fs.existsSync(sessionStorageTempFile)) {
      fs.unlinkSync(sessionStorageTempFile);
    }
    await browser.close();
  }
}

bootstrapAuthentication().catch((error) => {
  console.error(
    `[auth:export] failed while ${currentStep}: ${error.name}: ${safeErrorSummary(error)}`
  );
  console.error("[auth:export] any existing user.json was preserved");
  process.exitCode = 1;
});
