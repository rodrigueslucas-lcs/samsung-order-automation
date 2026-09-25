import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import authStateModule from "../../../../../utils/authState";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../support/base-store/mx.auth.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { createAuthState } = authStateModule;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

function renewSecondAccount(mxConfig) {
  if (process.env.CI && process.env.MX_AUTH_AUTO_RENEW !== "1") {
    test.skip(true, "Second MX account session is unavailable/expired in CI; refresh + verify the dedicated second-account credential before the P1 campaign.");
    return;
  }
  if (process.env.MX_AUTH_AUTO_RENEW === "0") {
    test.skip(true, "Second MX account session is unavailable/expired and automatic renewal is disabled.");
    return;
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

function authFingerprint(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath));
  return crypto.createHash("sha256").update(raw).digest("hex");
}

test("SAM-24986 @qst @mx @base-store @safe @registered - Cart is isolated from a second account", async ({ page, browser, mxConfig }, testInfo) => {
  testInfo.setTimeout(1200000);
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24986"));

  const suffix = mxConfig.environment.toLowerCase();
  const primaryState = `playwright/.auth/mx-${suffix}-user.json`;
  const secondState = process.env.MX_QST_SECOND_AUTH_STATE?.trim() || `playwright/.auth/mx-${suffix}-second-user.json`;
  const secondSession = process.env.MX_QST_SECOND_SESSION_STORAGE?.trim() || `playwright/.auth/mx-${suffix}-second-session-storage.json`;
  if (!fs.existsSync(path.resolve(secondState)) || !fs.existsSync(path.resolve(secondSession))) {
    renewSecondAccount(mxConfig);
  }

  expect(fs.existsSync(path.resolve(primaryState)), "Primary MX auth state must exist before cart-isolation validation.").toBeTruthy();
  expect(
    authFingerprint(primaryState),
    "Primary and second MX auth artifacts must not be byte-identical; provision a dedicated second account credential."
  ).not.toBe(authFingerprint(secondState));

  const secondAuth = createAuthState({
    authStatePath: secondState,
    sessionStoragePath: secondSession,
    hostname: mxConfig.hostname,
    setupUrl: null,
    validationUrl: mxConfig.baseUrl.toString(),
    label: `${mxConfig.environment} MX second account`,
    refreshInstruction: "Refresh + verify the dedicated second-account auth artifacts before the P1 campaign.",
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
  await test.step("Validate the dedicated second-account authenticated session", async () => {
    try {
      secondAccount = await openSecondAccount();
    } catch (error) {
      if (!/session is expired|access\/auth state is not usable|setup cookie is no longer valid/i.test(String(error?.message || error))) throw error;
      renewSecondAccount(mxConfig);
      secondAccount = await openSecondAccount();
    }
  });

  const { context: secondContext, secondPage } = secondAccount;
  try {
    await test.step("Prepare a controlled cart for the first authenticated account", async () => {
      const firstCart = await prepareMxQstCart(page, mxConfig);
      await firstCart.validateControlledSingleSku(mxConfig.sku);
    });

    await test.step("Verify the second account did not inherit the first account cart", async () => {
      await secondPage.goto(mxConfig.cartUrl.toString(), { waitUntil: "domcontentloaded" });
      const carriedSku = secondPage
        .getByRole("main")
        .getByText(mxConfig.sku, { exact: true })
        .filter({ visible: true });
      await expect(carriedSku).toHaveCount(0, { timeout: 30000 });
    });

    await test.step("Create and validate an independent cart for the second account", async () => {
      const secondCart = await prepareMxQstCart(secondPage, mxConfig);
      await secondCart.validateControlledSingleSku(mxConfig.sku);
    });

    recordBusinessEvidence(testInfo, {
      firstAccountSku: mxConfig.sku,
      secondAccountInheritedFirstCart: false,
      dedicatedSecondAuthArtifact: true,
      secondAccountCheckoutSku: mxConfig.sku,
      note: "Cart isolation is proven by two separately validated auth artifacts plus independent cart state; checkout email rendering is not a prerequisite of this TC.",
    });
  } finally {
    await secondContext.close();
  }
});
