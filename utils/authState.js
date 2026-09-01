const fs = require("node:fs");
const path = require("node:path");

function createAuthState({
  authStatePath,
  sessionStoragePath,
  hostname,
  setupUrl,
  validationUrl,
  label,
  refreshInstruction,
  enforceHostname = true,
  profileMenuTrigger = "click",
  logoutLinkName = null,
}) {
  const AUTH_STATE_PATH = path.resolve(authStatePath);
  const AUTH_SESSION_STORAGE_PATH = path.resolve(sessionStoragePath);
  const AUTH_REFRESH_INSTRUCTION = refreshInstruction;

  function requireAuthState() {
    if (
      !fs.existsSync(AUTH_STATE_PATH) ||
      !fs.existsSync(AUTH_SESSION_STORAGE_PATH)
    ) {
      throw new Error(
        `Authenticated ${label} state was not found. ${AUTH_REFRESH_INSTRUCTION}`
      );
    }

    return AUTH_STATE_PATH;
  }

  function hasAuthState() {
    return (
      fs.existsSync(AUTH_STATE_PATH) &&
      fs.existsSync(AUTH_SESSION_STORAGE_PATH)
    );
  }

  async function applyAuthSessionStorage(context) {
    requireAuthState();
    const sessionStorage = JSON.parse(
      fs.readFileSync(AUTH_SESSION_STORAGE_PATH, "utf8")
    );

    await context.addInitScript(
      ({ targetHostname, state }) => {
        if (window.location.hostname !== targetHostname) return;
        for (const [key, value] of Object.entries(state)) {
          window.sessionStorage.setItem(key, value);
        }
      },
      { targetHostname: hostname, state: sessionStorage }
    );
  }

  async function validateCurrentPageAuthenticated(page) {
    if (enforceHostname && new URL(page.url()).hostname !== hostname) {
      throw new Error(`Unexpected ${label} authentication host.`);
    }

    const profileButton = page.getByRole("button", {
      name: "My Profile",
      exact: true,
    });

    await profileButton.waitFor({ state: "visible", timeout: 60000 });
    await page.keyboard.press("Escape");

    const logout = logoutLinkName
      ? page.getByRole("link", { name: logoutLinkName }).filter({ visible: true })
      : page.getByText("Cerrar sesión", { exact: true }).filter({ visible: true });

    if (profileMenuTrigger === "hover") {
      await profileButton.hover();
      if (!(await logout.isVisible().catch(() => false))) {
        await profileButton.click();
      }
    } else {
      await profileButton.click();
    }

    await logout.waitFor({ state: "visible", timeout: 30000 }).catch(() => {
      throw new Error(
        `The saved Samsung storefront session is expired. ${AUTH_REFRESH_INSTRUCTION}`
      );
    });
  }

  async function validateAuthenticatedSession(page) {
    await page.goto(setupUrl, { waitUntil: "domcontentloaded" });
    if (enforceHostname && new URL(page.url()).hostname !== hostname) {
      throw new Error(`Unexpected ${label} setup host.`);
    }
    await page
      .getByText(/You can access pages now/i)
      .waitFor({ state: "visible", timeout: 60000 });

    await page.goto(validationUrl, { waitUntil: "domcontentloaded" });

    const maintenanceMessage = page.getByText(
      /SystemParking|Page Under Maintenance/i
    );

    if (await maintenanceMessage.count()) {
      throw new Error(
        `The saved ${label} setup cookie is no longer valid. ${AUTH_REFRESH_INSTRUCTION}`
      );
    }

    await validateCurrentPageAuthenticated(page);
  }

  return {
    AUTH_STATE_PATH,
    AUTH_SESSION_STORAGE_PATH,
    applyAuthSessionStorage,
    hasAuthState,
    requireAuthState,
    validateCurrentPageAuthenticated,
    validateAuthenticatedSession,
  };
}

const legacyPeAuthState = createAuthState({
  authStatePath: "playwright/.auth/user.json",
  sessionStoragePath: "playwright/.auth/session-storage.json",
  hostname: "stg2.shop.samsung.com",
  setupUrl: "https://stg2.shop.samsung.com/getcookie.html",
  validationUrl: "https://stg2.shop.samsung.com/pe/",
  label: "ST2",
  refreshInstruction:
    "Run `npm run auth:open-profile`, complete the login in normal Chrome, keep that Chrome open, then run `npm run auth:export` from another terminal.",
  enforceHostname: false,
});

module.exports = { ...legacyPeAuthState, createAuthState };
