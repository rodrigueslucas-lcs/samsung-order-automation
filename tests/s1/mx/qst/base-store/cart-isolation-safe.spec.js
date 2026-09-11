import fs from "node:fs";
import path from "node:path";
import authStateModule from "../../../../../utils/authState";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { createAuthState } = authStateModule;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-24986 @qst @mx @base-store @safe @registered - Cart is isolated from a second account", async ({ page, browser, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24986"));

  const secondState = process.env.MX_QST_SECOND_AUTH_STATE?.trim();
  const secondSession = process.env.MX_QST_SECOND_SESSION_STORAGE?.trim();
  test.skip(
    !secondState || !secondSession,
    "A dedicated second MX account auth state is required to prove cross-account cart isolation."
  );
  test.skip(
    !fs.existsSync(path.resolve(secondState)) || !fs.existsSync(path.resolve(secondSession)),
    "Second-account auth artifacts do not exist at the configured paths."
  );

  const firstCart = await prepareMxQstCart(page, mxConfig);
  await firstCart.validateControlledSingleSku(mxConfig.sku);

  const secondAuth = createAuthState({
    authStatePath: secondState,
    sessionStoragePath: secondSession,
    hostname: mxConfig.hostname,
    setupUrl: null,
    validationUrl: mxConfig.baseUrl.toString(),
    label: "S1 MX second account",
    refreshInstruction: "Refresh the dedicated second-account auth artifacts.",
    profileMenuTrigger: "hover",
    logoutTextName: /Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector: '[role="menu"].profile-menu',
  });

  const secondContext = await browser.newContext({
    storageState: path.resolve(secondState),
    viewport: { width: 1440, height: 900 },
  });
  try {
    await secondAuth.applyAuthSessionStorage(secondContext);
    const secondPage = await secondContext.newPage();
    await secondAuth.validateAuthenticatedSession(secondPage);
    await secondPage.goto(mxConfig.cartUrl.toString(), { waitUntil: "domcontentloaded" });

    const carriedSku = secondPage
      .getByRole("main")
      .getByText(mxConfig.sku, { exact: true })
      .filter({ visible: true });
    await expect(carriedSku).toHaveCount(0, { timeout: 30000 });

    recordBusinessEvidence(testInfo, {
      firstAccountSku: mxConfig.sku,
      secondAccountInheritedFirstCart: false,
      note: "Uses an independently authenticated second account; no credentials are embedded in the test.",
    });
  } finally {
    await secondContext.close();
  }
});
