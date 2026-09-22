import { test as base, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import mxConfigModule from "../../../../../utils/mxConfig";
import mxAuthState from "../../../../../utils/mxAuthState";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";

const { getMxConfig } = mxConfigModule;
const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  installPersistedBrowserState,
  markAuthStateVerified,
  refreshAuthenticatedState,
  validateCurrentPageAuthenticated,
  validateAuthenticatedSession,
} = mxAuthState;
const { assertMxStagingPage } = mxStagingGuard;

function isRecoverableAuthFailure(error) {
  const message = String(error?.message || error || "");
  return /session is expired|access\/auth state is not usable|setup cookie is no longer valid/i.test(message);
}

function autoRenewAllowed() {
  if (process.env.MX_AUTH_AUTO_RENEW === "0") return false;
  if (process.env.CI && process.env.MX_AUTH_AUTO_RENEW !== "1") return false;
  return true;
}

async function renewMxAuthSession({ context, page, mxConfig }) {
  if (!autoRenewAllowed()) {
    throw new Error(
      "MX authenticated session expired and automatic renewal is disabled in this runtime. " +
      "Set MX_AUTH_AUTO_RENEW=1 only where interactive Samsung Account verification can be completed safely."
    );
  }

  console.warn(`[mx-auth] ${mxConfig.environment || process.env.MX_QST_ENVIRONMENT || "MX"} session expired; starting one controlled auth renewal.`);

  const loginScript = path.resolve("scripts/auth-login-mx.cjs");
  const renewal = spawnSync(process.execPath, [loginScript], {
    stdio: "inherit",
    env: {
      ...process.env,
      MX_QST_ENVIRONMENT: process.env.MX_QST_ENVIRONMENT || mxConfig.environment || "S1",
    },
  });

  if (renewal.error) {
    throw new Error(`MX auth renewal could not start: ${renewal.error.message}`);
  }
  if (renewal.status !== 0) {
    throw new Error(
      `MX auth renewal did not complete successfully (exit ${renewal.status ?? "unknown"}). ` +
      "If Samsung Account shows CAPTCHA/MFA, complete it in the dedicated Chrome window and let the auth flow return to the MX storefront."
    );
  }

  // The Playwright test context was created before the fresh state was exported.
  // Hydrate that existing context with the newly written cookies/local/session storage,
  // then prove authentication again before allowing the registered TC to continue.
  await installPersistedBrowserState(context, page);
  await validateAuthenticatedSession(page);
  await refreshAuthenticatedState(context, page);
  markAuthStateVerified();
  console.log("[mx-auth] authenticated session renewed and reloaded into the current test context.");
}

export const test = base.extend({
  mxConfig: async ({}, use) => {
    await use(getMxConfig());
  },
  storageState: hasAuthState() ? AUTH_STATE_PATH : undefined,
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--start-maximized"] },
});

test.beforeEach(async ({ context, page, mxConfig }, testInfo) => {
  testInfo.setTimeout(780000);
  test.skip(!hasAuthState(), "Dedicated MX authenticated state is required.");
  await applyAuthSessionStorage(context);

  try {
    await validateAuthenticatedSession(page);
  } catch (error) {
    if (!isRecoverableAuthFailure(error)) throw error;
    await renewMxAuthSession({ context, page, mxConfig });
  }

  await assertMxStagingPage(page, "MX authenticated fixture");
  await refreshAuthenticatedState(context, page);
  markAuthStateVerified();
  await page.mouse.move(20, 500);
  await page.keyboard.press("Escape");
  await page
    .locator('[role="menu"].profile-menu')
    .filter({ hasText: /Cerrar Sesi[oó]n/i })
    .filter({ visible: true })
    .waitFor({ state: "hidden", timeout: 30000 });
});

test.afterEach(async ({ context, page, mxConfig }, testInfo) => {
  if (!hasAuthState() || page.url() === "about:blank") return;
  const currentUrl = page.url();
  if (/^chrome-error:\/\/chromewebdata\//i.test(currentUrl)) return;
  const paymentTc = testInfo.title.includes("SAM-25002") || testInfo.title.includes("SAM-25010");
  if (paymentTc && process.env.ALLOW_PAYMENT_SUBMIT === "1" && testInfo.status === "failed" &&
      new URL(currentUrl).hostname === "www.mercadopago.com.mx") return;
  await assertMxStagingPage(page, "MX authenticated final environment guard");
  if (testInfo.status === "passed") {
    // Preserve a legitimately rotated session for the next isolated context.
    // Never replace the saved state with a signed-out checkout page.
    try {
      await page.goto(mxConfig.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await validateCurrentPageAuthenticated(page);
      await refreshAuthenticatedState(context, page);
      markAuthStateVerified();
    } catch {
      console.warn("[mx-auth] Session could not be revalidated after the test; preserving the last authenticated state.");
    }
  }
});

export { expect };
