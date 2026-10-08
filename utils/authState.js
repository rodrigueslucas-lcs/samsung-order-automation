const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomically } = require("./atomicJson");

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
  profileButtonSelector = null,
  logoutLinkName = null,
  logoutTextName = "Cerrar sesión",
  authenticatedMenuSelector = null,
  profileMenuReadySelector = null,
  storefrontDismissTextName = null,
  navigationTimeoutMs = null,
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

  function readPersistedAuthState() {
    requireAuthState();
    return {
      browserState: JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8")),
      sessionStorage: JSON.parse(fs.readFileSync(AUTH_SESSION_STORAGE_PATH, "utf8")),
    };
  }

  async function installPersistedBrowserState(context, page = null) {
    const { browserState, sessionStorage } = readPersistedAuthState();
    const targetOrigin = `https://${hostname}`;
    const targetLocalStorage = (browserState.origins || [])
      .find(({ origin }) => origin === targetOrigin)?.localStorage || [];

    if (Array.isArray(browserState.cookies) && browserState.cookies.length) {
      await context.addCookies(browserState.cookies);
    }

    await context.addInitScript(
      ({ targetHostname, sessionState, localState }) => {
        if (window.location.hostname !== targetHostname) return;
        for (const [key, value] of Object.entries(sessionState || {})) {
          window.sessionStorage.setItem(key, value);
        }
        for (const item of localState || []) {
          if (item?.name != null) window.localStorage.setItem(item.name, item.value ?? "");
        }
      },
      { targetHostname: hostname, sessionState: sessionStorage, localState: targetLocalStorage }
    );

    if (page) {
      let currentHostname = "";
      try { currentHostname = new URL(page.url()).hostname; } catch {}
      if (currentHostname === hostname) {
        await page.evaluate(
          ({ sessionState, localState }) => {
            for (const [key, value] of Object.entries(sessionState || {})) {
              window.sessionStorage.setItem(key, value);
            }
            for (const item of localState || []) {
              if (item?.name != null) window.localStorage.setItem(item.name, item.value ?? "");
            }
          },
          { sessionState: sessionStorage, localState: targetLocalStorage }
        );
      }
    }
  }

  async function applyAuthSessionStorage(context) {
    const { sessionStorage } = readPersistedAuthState();

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
      try {
        writeJsonAtomically(destination, value);
      } catch (error) {
        throw new Error(`Could not refresh ${label} auth state safely: ${error.message}`);
      }
    }
  }

  async function gotoWithNetworkRetry(page, url, options = {}) {
    const effectiveOptions = {
      ...options,
      ...(navigationTimeoutMs != null && options.timeout == null ? { timeout: navigationTimeoutMs } : {}),
    };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await page.goto(url, effectiveOptions);
      } catch (error) {
        const retryableNavigation = /TimeoutError|timeout .* exceeded|ERR_CONNECTION_TIMED_OUT|ERR_NETWORK_CHANGED|ERR_ABORTED|ERR_NETWORK_IO_SUSPENDED|frame was detached/i.test(
          String(error?.name || "") + " " + String(error?.message || error)
        );
        if (!retryableNavigation || attempt === 3) throw error;
        console.warn(`[auth-state:${label}] transient navigation failure; retrying ${attempt + 1}/3`);
        await page.waitForTimeout(2000 * attempt);
      }
    }
    return null;
  }

  async function validateCurrentPageAuthenticated(page) {
    if (enforceHostname && new URL(page.url()).hostname !== hostname) {
      throw new Error(`Unexpected ${label} authentication host.`);
    }

    if (storefrontDismissTextName) {
      const dismiss = page.getByText(storefrontDismissTextName, { exact: true }).filter({ visible: true }).first();
      if (await dismiss.isVisible().catch(() => false)) {
        await dismiss.click({ timeout: 5000 });
        await dismiss.waitFor({ state: "hidden", timeout: 5000 });
      }
    }

    const profileByRole = page.getByRole("button", { name: "My Profile", exact: true });
    const profileButton = profileButtonSelector
      ? profileByRole.or(page.locator(profileButtonSelector)).filter({ visible: true }).first()
      : profileByRole;

    const profileVisible = await profileButton
      .waitFor({ state: "visible", timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    if (!profileVisible) {
      throw new Error(
        `The saved ${label} storefront access/auth state is not usable; the storefront did not render its profile control. ${AUTH_REFRESH_INSTRUCTION}`
      );
    }
    await page.keyboard.press("Escape");

    const menuRoot = authenticatedMenuSelector
      ? page.locator(authenticatedMenuSelector).filter({ visible: true }).last()
      : null;
    const logout = menuRoot
      ? menuRoot.getByText(logoutTextName, { exact: false }).filter({ visible: true }).last()
      : logoutLinkName
        ? page.getByRole("link", { name: logoutLinkName }).filter({ visible: true })
        : page.getByText(logoutTextName, { exact: false }).filter({ visible: true }).last();

    const menuReady = profileMenuReadySelector
      ? page.locator(profileMenuReadySelector).filter({ visible: true }).last()
      : menuRoot;

    if (profileMenuTrigger === "hover") {
      await profileButton.hover();
      const openedFromHover = await (menuReady || logout)
        .waitFor({ state: "visible", timeout: 1000 })
        .then(() => true)
        .catch(() => false);
      if (!openedFromHover) await profileButton.click();
    } else {
      await profileButton.click();
    }

    if (menuReady) {
      await menuReady.waitFor({ state: "visible", timeout: authenticatedMenuSelector ? 5000 : 30000 }).catch(() => {
        throw new Error(
          `The saved ${label} profile menu did not open. ${AUTH_REFRESH_INSTRUCTION}`
        );
      });
    }

    if (menuRoot && await menuRoot.locator('a[data-an-la="login"]')
      .filter({ visible: true }).isVisible().catch(() => false)) {
      throw new Error(`The saved ${label} storefront session is signed out. ${AUTH_REFRESH_INSTRUCTION}`);
    }

    const authenticated = await logout
      .waitFor({ state: "visible", timeout: authenticatedMenuSelector ? 5000 : 30000 })
      .then(() => true)
      .catch(() => false);
    if (!authenticated) {
      const signedOut = menuRoot
        ? await menuRoot.locator('a[data-an-la="login"]').filter({ visible: true }).count().catch(() => 0)
        : 0;
      throw new Error(
        signedOut
          ? `The saved ${label} storefront session is signed out. ${AUTH_REFRESH_INSTRUCTION}`
          : `The saved ${label} profile menu opened but authenticated logout control was not rendered. Authentication could not be proven. ${AUTH_REFRESH_INSTRUCTION}`
      );
    }
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
    installPersistedBrowserState,
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
