import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../../utils/mxConfig";
import mxAuthState from "../../../../../utils/mxAuthState";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";

const { getMxConfig } = mxConfigModule;
const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  refreshAuthenticatedState,
  validateCurrentPageAuthenticated,
  validateAuthenticatedSession,
} = mxAuthState;
const { assertMxStagingPage } = mxStagingGuard;

export const test = base.extend({
  mxConfig: async ({}, use) => {
    await use(getMxConfig());
  },
  storageState: hasAuthState() ? AUTH_STATE_PATH : undefined,
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--start-maximized"] },
});

test.beforeEach(async ({ context, page }, testInfo) => {
  testInfo.setTimeout(180000);
  test.skip(!hasAuthState(), "Dedicated MX S1 authenticated state is required.");
  await applyAuthSessionStorage(context);
  await validateAuthenticatedSession(page);
  await assertMxStagingPage(page, "MX authenticated fixture");
  await refreshAuthenticatedState(context, page);
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
    } catch {
      console.warn("[mx-auth] Session could not be revalidated after the test; preserving the last authenticated state.");
    }
  }
});

export { expect };
