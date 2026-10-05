const { spawnSync } = require("node:child_process");
const path = require("node:path");

const GUARDED_CONTEXT = Symbol.for("samsung.registeredSessionRecovery.guardedContext");

function isCiRuntime() {
  return Boolean(process.env.CI || process.env.JENKINS_URL || process.env.JENKINS_HOME);
}

function isRecoverableRegisteredAuthFailure(error) {
  const message = String(error?.message || error || "");
  return /session is signed out|session is expired|access\/auth state is not usable|setup cookie is no longer valid|profile menu opened but authenticated logout control was not rendered/i.test(message);
}

function autoRenewAllowed(envName) {
  const value = String(process.env[envName] || "").trim();
  if (value === "0") return false;
  if (isCiRuntime() && value !== "1") return false;
  return true;
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

  async function validateAuthenticatedSession(page) {
    try {
      return await strictValidate(page);
    } catch (error) {
      if (!isRecoverableRegisteredAuthFailure(error)) throw error;

      if (!enabled) {
        throw new Error(
          `AUTH RECOVERY REQUIRED · ${label} registered session is no longer authenticated and this storefront uses an external/shared login bootstrap. Refresh the dedicated auth bundle before rerunning.`
        );
      }

      if (!autoRenewAllowed(autoRenewEnv)) {
        throw new Error(
          `AUTH RECOVERY REQUIRED · ${label} registered session expired. Automatic interactive renewal is disabled in this runtime. Refresh and publish the auth bundle, or explicitly set ${autoRenewEnv}=1 only on a runner where Samsung Account verification can be completed safely.`
        );
      }

      console.warn(`[registered-auth] ${label} session is signed out; starting one controlled Samsung Account renewal instead of waiting for downstream registered steps to time out.`);

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

      // The renewal script writes fresh ignored auth artifacts. Inject those
      // rotated cookies/storage into the current Playwright context so the
      // current registered TC can continue without being restarted.
      await installState(page.context(), page);
      await strictValidate(page);
      await refreshState(page.context(), page);

      console.log(`[registered-auth] ${label} session renewed, validated, and reloaded into the current test context.`);
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
