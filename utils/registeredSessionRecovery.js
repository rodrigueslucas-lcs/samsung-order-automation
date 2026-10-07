const { spawnSync } = require("node:child_process");
const path = require("node:path");

const GUARDED_CONTEXT = Symbol.for("samsung.registeredSessionRecovery.guardedContext");
const RECOVERY_IN_FLIGHT = Symbol.for("samsung.registeredSessionRecovery.inFlight");

function isCiRuntime() {
  return Boolean(process.env.CI || process.env.JENKINS_URL || process.env.JENKINS_HOME);
}

function isRecoverableRegisteredAuthFailure(error) {
  const message = String(error?.message || error || "");
  return /session is signed out|session is expired|access\/auth state is not usable|setup cookie is no longer valid|profile menu did not open|profile menu opened but authenticated logout control was not rendered/i.test(message);
}

function autoRenewAllowed(envName) {
  const value = String(process.env[envName] || "").trim();
  if (value === "0") return false;
  if (isCiRuntime() && value !== "1") return false;
  return true;
}

function rehydrateAllowed() {
  return String(process.env.REGISTERED_AUTH_REHYDRATE || "1").trim() !== "0";
}

function withRegisteredSessionRecovery(authState, {
  market,
  environment,
  loginScript,
  autoRenewEnv,
  env = {},
  enabled = true,
  guardFuturePages = true,
} = {}) {
  if (!authState || typeof authState.validateAuthenticatedSession !== "function") {
    throw new Error("A valid auth state is required for registered-session recovery.");
  }

  const strictValidate = authState.validateAuthenticatedSession.bind(authState);
  const installState = authState.installPersistedBrowserState.bind(authState);
  const refreshState = authState.refreshAuthenticatedState.bind(authState);
  const applySessionStorage = authState.applyAuthSessionStorage.bind(authState);
  const label = `${market || "storefront"} ${environment || ""}`.trim();

  async function persistValidatedState(page) {
    const result = await strictValidate(page);
    await refreshState(page.context(), page);
    return result;
  }

  async function tryPersistedStateRecovery(page) {
    if (!rehydrateAllowed()) return false;
    try {
      console.warn(`[registered-auth] ${label} auth validation failed; reloading the freshest persisted browser/session state once.`);
      await installState(page.context(), page);
      await persistValidatedState(page);
      console.log(`[registered-auth] ${label} session recovered from the latest persisted state without restarting the TC.`);
      return true;
    } catch (error) {
      console.warn(`[registered-auth] ${label} persisted-state recovery did not restore authentication: ${String(error?.message || error).split("\n")[0]}`);
      return false;
    }
  }

  async function renewSamsungAccount(page) {
    if (!enabled) {
      throw new Error(
        `AUTH RECOVERY REQUIRED · ${label} registered session is no longer authenticated and this storefront uses an external/shared login bootstrap. Refresh the dedicated auth bundle before rerunning.`
      );
    }

    if (!autoRenewAllowed(autoRenewEnv)) {
      throw new Error(
        `AUTH RECOVERY REQUIRED · ${label} registered session expired after persisted-state recovery. Automatic interactive renewal is disabled in this runtime. Refresh and publish the auth bundle, or explicitly set ${autoRenewEnv}=1 only on a runner where Samsung Account verification can be completed safely.`
      );
    }

    console.warn(`[registered-auth] ${label} session is still signed out; starting one controlled Samsung Account renewal.`);

    const renewal = spawnSync(process.execPath, [path.resolve(loginScript)], {
      stdio: "inherit",
      env: {
        ...process.env,
        ...env,
      },
    });

    if (renewal.error) {
      throw new Error(`AUTH RECOVERY REQUIRED · ${label} renewal could not start: ${renewal.error.message}`);
    }
    if (renewal.status !== 0) {
      throw new Error(
        `AUTH RECOVERY REQUIRED · ${label} Samsung Account renewal exited with code ${renewal.status ?? "unknown"}. If CAPTCHA/MFA was shown, complete it in the dedicated Chrome and rerun after the auth refresh succeeds.`
      );
    }

    await installState(page.context(), page);
    await persistValidatedState(page);
    console.log(`[registered-auth] ${label} session renewed, validated, and reloaded into the current test context.`);
  }

  async function recoverOnce(page) {
    const context = page.context();
    if (context[RECOVERY_IN_FLIGHT]) return context[RECOVERY_IN_FLIGHT];

    const recovery = (async () => {
      if (await tryPersistedStateRecovery(page)) return;
      await renewSamsungAccount(page);
    })();

    Object.defineProperty(context, RECOVERY_IN_FLIGHT, {
      value: recovery,
      configurable: true,
      enumerable: false,
      writable: true,
    });

    try {
      await recovery;
    } finally {
      try { delete context[RECOVERY_IN_FLIGHT]; } catch {}
    }
  }

  async function validateAuthenticatedSession(page) {
    try {
      return await persistValidatedState(page);
    } catch (error) {
      if (!isRecoverableRegisteredAuthFailure(error)) throw error;
      await recoverOnce(page);
      return true;
    }
  }

  async function applyAuthSessionStorage(context) {
    await applySessionStorage(context);
    if (!guardFuturePages || context[GUARDED_CONTEXT]) return;

    const originalNewPage = context.newPage.bind(context);
    Object.defineProperty(context, GUARDED_CONTEXT, {
      value: true,
      configurable: false,
      enumerable: false,
    });
    context.newPage = async (...args) => {
      const page = await originalNewPage(...args);
      try {
        await validateAuthenticatedSession(page);
        await page.keyboard.press("Escape").catch(() => {});
        return page;
      } catch (error) {
        await page.close().catch(() => {});
        throw error;
      }
    };
  }

  return {
    ...authState,
    applyAuthSessionStorage,
    validateAuthenticatedSession,
  };
}

module.exports = {
  isCiRuntime,
  isRecoverableRegisteredAuthFailure,
  withRegisteredSessionRecovery,
};
