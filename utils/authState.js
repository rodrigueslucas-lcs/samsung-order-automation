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
  logoutTextName = "Cerrar sesión",
  authenticatedMenuSelector = null,
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

  async function refreshAuthenticatedState(context, page) {
    // Call only after validating the authenticated storefront UI. A new
    // Playwright context must receive the latest rotated Samsung cookies.
    requireAuthState();
    if (new URL(page.url()).hostname !== hostname) {
      throw new Error(`Cannot refresh ${label} auth state from another host.`);
    }
    const state = await context.storageState({ indexedDB: true });
    const filteredState = {
      cookies: state.cookies.filter((cookie) => {
        const domain = cookie.domain.replace(/^\./, "");
        return domain === hostname || cookie.domain === ".samsung.com";
      }),
      origins: state.origins.filter(({ origin }) => new URL(origin).hostname === hostname),
    };
    if (!filteredState.cookies.some((cookie) => cookie.domain.replace(/^\./, "") === hostname)) {
      throw new Error(`Cannot refresh ${label} auth state without storefront cookies.`);
    }
    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );
    for (const [destination, value] of [
      [AUTH_STATE_PATH, filteredState],
      [AUTH_SESSION_STORAGE_PATH, sessionStorage],
    ]) {
      const temporary = `${destination}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
      fs.chmodSync(temporary, 0o600);
      try {
        fs.renameSync(temporary, destination);
      } catch (error) {
        fs.rmSync(temporary, { force: true });
        throw new Error(`Could not refresh ${label} auth state safely: ${error.message}`);
      }
    }
  }

  async function gotoWithNetworkRetry(page, url, options = {}) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await page.goto(url, options);
      } catch (error) {
        const transientNetworkChange = /net::ERR_NETWORK_CHANGED/i.test(
          String(error?.message || error)
        );
        if (!transientNetworkChange || attempt === 2) throw error;
        await page.waitForTimeout(1000);
      }
    }
    return null;
  }

  async function validateCurrentPageAuthenticated(page) {
    if (enforceHostname && new URL(page.url()).hostname !== hostname) {
      throw new Error(`Unexpected ${label} authentication host.`);
    }

    const profileButton = page.getByRole("button", {
      name: "My Profile",
      exact: true,
    });

    const profileVisible = await profileButton
      .waitFor({ state: "visible", timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    if (!profileVisible) {
      throw new Error(
        `The saved ${label} storefront access/auth state is not usable; the storefront did not render My Profile. ${AUTH_REFRESH_INSTRUCTION}`
      );
    }
    await page.keyboard.press("Escape");

    const logout = authenticatedMenuSelector
      ? page
          .locator(authenticatedMenuSelector)
          .filter({ hasText: logoutTextName })
          .filter({ visible: true })
          .last()
      : logoutLinkName
        ? page.getByRole("link", { name: logoutLinkName }).filter({ visible: true })
        : page.getByText(logoutTextName, { exact: true }).filter({ visible: true });

    if (profileMenuTrigger === "hover") {
      await profileButton.hover();
      const openedFromHover = await logout
        .waitFor({ state: "visible", timeout: authenticatedMenuSelector ? 10000 : 1000 })
        .then(() => true)
        .catch(() => false);
      if (!openedFromHover) {
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
    if (setupUrl) {
      await gotoWithNetworkRetry(page, setupUrl, { waitUntil: "domcontentloaded" });
      if (enforceHostname && new URL(page.url()).hostname !== hostname) {
        throw new Error(`Unexpected ${label} setup host.`);
      }
      await page
        .getByText(/You can access pages now/i)
        .waitFor({ state: "visible", timeout: 60000 });
    }

    await gotoWithNetworkRetry(page, validationUrl, { waitUntil: "domcontentloaded" });

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
    refreshAuthenticatedState,
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
