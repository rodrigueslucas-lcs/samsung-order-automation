import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import authStateModule from "../../../../../utils/authState";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { createAuthState } = authStateModule;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

function renewSecondAccount(mxConfig) {
  if (process.env.CI && process.env.MX_AUTH_AUTO_RENEW !== "1") {
    throw new Error("Second MX account session expired in CI; interactive renewal is disabled.");
  }
  if (process.env.MX_AUTH_AUTO_RENEW === "0") {
    throw new Error("Second MX account session expired and automatic renewal is disabled.");
  }
  console.log("[mx-auth] Renewing the dedicated second MX account; complete Samsung Account login/CAPTCHA/MFA manually in its visible Chrome if prompted.");
  const renewal = spawnSync(process.execPath, [path.resolve("scripts/auth-login-mx.cjs")], {
    stdio: "inherit",
    env: { ...process.env, MX_QST_ENVIRONMENT: mxConfig.environment, MX_AUTH_SLOT: "second", MX_AUTH_MANUAL: "1" },
  });
  if (renewal.error || renewal.status !== 0) {
    throw new Error(`Second MX account renewal did not complete (exit ${renewal.status ?? "unknown"}).`);
  }
}

test("SAM-24986 @qst @mx @base-store @safe @registered - Cart is isolated from a second account", async ({ page, browser, mxConfig }, testInfo) => {
  testInfo.setTimeout(1200000);
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24986"));

  const suffix = mxConfig.environment.toLowerCase();
  const secondState = process.env.MX_QST_SECOND_AUTH_STATE?.trim() || `playwright/.auth/mx-${suffix}-second-user.json`;
  const secondSession = process.env.MX_QST_SECOND_SESSION_STORAGE?.trim() || `playwright/.auth/mx-${suffix}-second-session-storage.json`;
  if (!fs.existsSync(path.resolve(secondState)) || !fs.existsSync(path.resolve(secondSession))) {
    renewSecondAccount(mxConfig);
  }

  const secondAuth = createAuthState({
    authStatePath: secondState,
    sessionStoragePath: secondSession,
    hostname: mxConfig.hostname,
    setupUrl: null,
    validationUrl: mxConfig.baseUrl.toString(),
    label: `${mxConfig.environment} MX second account`,
    refreshInstruction: "Refresh the dedicated second-account auth artifacts.",
    profileMenuTrigger: "hover",
    logoutTextName: /Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector: '[role="menu"].profile-menu',
  });

  async function openSecondAccount() {
    const context = await browser.newContext({
      storageState: path.resolve(secondState),
      viewport: { width: 1440, height: 900 },
    });
    try {
      await secondAuth.applyAuthSessionStorage(context);
      const secondPage = await context.newPage();
      await secondAuth.validateAuthenticatedSession(secondPage);
      return { context, secondPage };
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  let secondAccount;
  try {
    secondAccount = await openSecondAccount();
  } catch (error) {
    if (!/session is expired|access\/auth state is not usable|setup cookie is no longer valid/i.test(String(error?.message || error))) throw error;
    renewSecondAccount(mxConfig);
    secondAccount = await openSecondAccount();
  }

  const { context: secondContext, secondPage } = secondAccount;
  try {
    const firstCart = await prepareMxQstCart(page, mxConfig);
    await firstCart.validateControlledSingleSku(mxConfig.sku);
    await firstCart.proceedToAuthenticatedCheckout();
    const firstEmailField = page.getByRole("textbox", { name: "email", exact: true });
    await expect(firstEmailField).toBeVisible({ timeout: 30000 });
    const firstEmail = (await firstEmailField.inputValue()).trim().toLowerCase();
    expect(firstEmail, "First account checkout must identify its owner.").toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);

    await secondPage.goto(mxConfig.cartUrl.toString(), { waitUntil: "domcontentloaded" });

    const carriedSku = secondPage
      .getByRole("main")
      .getByText(mxConfig.sku, { exact: true })
      .filter({ visible: true });
    await expect(carriedSku).toHaveCount(0, { timeout: 30000 });

    const secondCart = await prepareMxQstCart(secondPage, mxConfig);
    await secondCart.validateControlledSingleSku(mxConfig.sku);
    await secondCart.proceedToAuthenticatedCheckout();
    const secondEmailField = secondPage.getByRole("textbox", { name: "email", exact: true });
    await expect(secondEmailField).toBeVisible({ timeout: 30000 });
    const secondEmail = (await secondEmailField.inputValue()).trim().toLowerCase();
    expect(secondEmail, "Second account checkout must identify its owner.").toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(secondEmail, "Both exported sessions must belong to different accounts.").not.toBe(firstEmail);

    recordBusinessEvidence(testInfo, {
      firstAccountSku: mxConfig.sku,
      secondAccountInheritedFirstCart: false,
      distinctCheckoutAccounts: true,
      secondAccountCheckoutSku: mxConfig.sku,
      note: "Uses an independently authenticated second account; no credentials are embedded in the test.",
    });
  } finally {
    await secondContext.close();
  }
});
