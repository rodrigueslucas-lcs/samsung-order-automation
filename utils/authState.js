const fs = require("node:fs");
const path = require("node:path");

const AUTH_STATE_PATH = path.resolve("playwright/.auth/user.json");
const AUTH_SESSION_STORAGE_PATH = path.resolve(
  "playwright/.auth/session-storage.json"
);
const AUTH_REFRESH_INSTRUCTION =
  "Run `npm run auth:open-profile`, complete the login in normal Chrome, keep that Chrome open, then run `npm run auth:export` from another terminal.";

function requireAuthState() {
  if (
    !fs.existsSync(AUTH_STATE_PATH) ||
    !fs.existsSync(AUTH_SESSION_STORAGE_PATH)
  ) {
    throw new Error(
      `Authenticated ST2 state was not found. ${AUTH_REFRESH_INSTRUCTION}`
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
    ({ hostname, state }) => {
      if (window.location.hostname !== hostname) {
        return;
      }

      for (const [key, value] of Object.entries(state)) {
        window.sessionStorage.setItem(key, value);
      }
    },
    {
      hostname: "stg2.shop.samsung.com",
      state: sessionStorage,
    }
  );
}

async function validateCurrentPageAuthenticated(page) {
  const profileButton = page.getByRole("button", {
    name: "My Profile",
    exact: true,
  });

  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  await page.keyboard.press("Escape");
  await profileButton.click();

  const logout = page
    .getByText("Cerrar sesión", { exact: true })
    .filter({ visible: true });

  await logout
    .waitFor({ state: "visible", timeout: 30000 })
    .catch(() => {
      throw new Error(
        `The saved Samsung storefront session is expired. ${AUTH_REFRESH_INSTRUCTION}`
      );
    });
}

async function validateAuthenticatedSession(page) {
  await page.goto("https://stg2.shop.samsung.com/getcookie.html", {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByText(/You can access pages now/i)
    .waitFor({ state: "visible", timeout: 60000 });

  await page.goto("https://stg2.shop.samsung.com/pe/", {
    waitUntil: "domcontentloaded",
  });

  const maintenanceMessage = page.getByText(
    /SystemParking|Page Under Maintenance/i
  );

  if (await maintenanceMessage.count()) {
    throw new Error(
      `The saved ST2 setup cookie is no longer valid. ${AUTH_REFRESH_INSTRUCTION}`
    );
  }

  await validateCurrentPageAuthenticated(page);
}

module.exports = {
  AUTH_STATE_PATH,
  AUTH_SESSION_STORAGE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  requireAuthState,
  validateCurrentPageAuthenticated,
  validateAuthenticatedSession,
};
