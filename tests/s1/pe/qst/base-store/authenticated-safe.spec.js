import { expect, test } from "@playwright/test";
import MyOrdersPage from "../../../../../pages/MyOrdersPage";
import peAuthStateModule from "../../../../../utils/peAuthState";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";

const {
  PE_AUTH_STATE_PATH,
  getPeAuthState,
  hasPeAuthState,
} = peAuthStateModule;
const { getPeS1QstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

test.describe("PE S1 QST - authenticated safe reuse", () => {
  test.use({ storageState: hasPeAuthState() ? PE_AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required for PE S1 authenticated QSTs.");
    test.skip(
      !hasPeAuthState(),
      "Authenticated PE S1 state is required in the dedicated ignored PE auth artifacts."
    );
    const auth = getPeAuthState();
    await auth.applyAuthSessionStorage(context);
  });

  test("SAM-25055 @qst @pe @base-store @safe @registered @reuse - Login Home page", async ({ page }, testInfo) => {
    test.setTimeout(180000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25055"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);

    const config = getPeS1QstConfig();
    const finalUrl = new URL(page.url());
    expect(finalUrl.hostname).toBe(config.baseUrl.hostname);
    expect(finalUrl.pathname.toLowerCase()).toBe("/pe/");

    testInfo.annotations.push({
      type: "qst-reuse-note",
      description: "Restored authenticated S1 PE session is validated on Home. This reuses the proven ST2 auth-state pattern; refresh/export remains a legitimate human-auth bootstrap, not an SSO bypass.",
    });
  });

  test("SAM-25057 @qst @pe @base-store @safe @registered @reuse - My Orders page", async ({ page }, testInfo) => {
    test.setTimeout(180000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25057"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);

    const config = getPeS1QstConfig();
    const myOrders = new MyOrdersPage(page, {
      origin: config.baseUrl.origin,
      market: "pe",
    });
    await myOrders.openMyOrders();
    const orderCodes = await myOrders.visibleOrderCodes();

    expect(orderCodes.length).toBeGreaterThan(0);
    testInfo.annotations.push({
      type: "qst-order-history-count",
      description: String(orderCodes.length),
    });
  });
});
