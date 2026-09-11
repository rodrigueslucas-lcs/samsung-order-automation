import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../../utils/mxConfig";
import mxAuthState from "../../../../../utils/mxAuthState";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";

const { getMxConfig } = mxConfigModule;
const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  validateAuthenticatedSession,
} = mxAuthState;
const { assertMxStagingPage } = mxStagingGuard;

export const test = base.extend({
  mxConfig: async ({}, use) => {
    await use(getMxConfig());
  },
});

test.use({
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
  await page.mouse.move(20, 500);
  await page.keyboard.press("Escape");
  await page
    .locator('[role="menu"].profile-menu')
    .filter({ hasText: /Cerrar Sesi[oó]n/i })
    .filter({ visible: true })
    .waitFor({ state: "hidden", timeout: 30000 });
});

test.afterEach(async ({ page }) => {
  if (!hasAuthState() || page.url() === "about:blank") return;
  await assertMxStagingPage(page, "MX authenticated final environment guard");
});

export { expect };
