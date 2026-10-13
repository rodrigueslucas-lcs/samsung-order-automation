import { expect, test } from "@playwright/test";
import MyOrdersPage from "../../../../../pages/MyOrdersPage";
import peAuthStateModule from "../../../../../utils/peAuthState";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";

const {
  PE_AUTH_STATE_PATH,
  getPeAuthState,
  hasPeAuthState,
} = peAuthStateModule;
const { getPeQstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

test.describe("PE QST - authenticated safe reuse", () => {
  test.use({ storageState: hasPeAuthState() ? PE_AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required for PE authenticated QSTs.");
    test.skip(
      !hasPeAuthState(),
      "Authenticated PE state is required in the dedicated ignored PE auth artifacts."
    );
    const auth = getPeAuthState();
    await auth.applyAuthSessionStorage(context);
  });

  test("SAM-25055 @qst @pe @base-store @safe @registered @reuse - Login Home page", async ({ page }, testInfo) => {
    test.setTimeout(180000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25055"));

    const auth = getPeAuthState();
    await test.step("Validate authenticated PE storefront session", async () => {
      await auth.validateAuthenticatedSession(page);
    });

    const config = getPeQstConfig();
    const finalUrl = new URL(page.url());
    expect(finalUrl.hostname).toBe(config.baseUrl.hostname);
    expect(finalUrl.pathname.toLowerCase()).toBe("/pe/");

    testInfo.annotations.push({
      type: "qst-reuse-note",
      description: "Restored authenticated PE session is validated on Home. This reuses the proven ST2 auth-state pattern; refresh/export remains a legitimate human-auth bootstrap, not an SSO bypass.",
    });
  });

  test("SAM-25057 @qst @pe @base-store @safe @registered @reuse - My Orders page", async ({ page }, testInfo) => {
    test.setTimeout(180000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25057"));

    const auth = getPeAuthState();
    await test.step("Validate authenticated PE storefront session", async () => {
      await auth.validateAuthenticatedSession(page);
    });

    const config = getPeQstConfig();
    const myOrders = new MyOrdersPage(page, {
      origin: config.baseUrl.origin,
      market: "pe",
    });
    let history;
    await test.step("Open My Orders", async () => {
      const responsePromise = page.waitForResponse((response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.endsWith("/v2/pe/users/current/orders")
      );
      await myOrders.openMyOrders();
      const response = await responsePromise;
      expect(response.status(), "Authenticated PE order history API must succeed").toBe(200);
      history = await response.json();
    });
    await test.step("Validate order history is available", async () => {
      if (config.environment === "S1" &&
          Array.isArray(history.currentOrders) && history.currentOrders.length === 0 &&
          Array.isArray(history.previousOrders) && history.previousOrders.length === 0) {
        await expect(page).toHaveURL(/\/pe\/mypage\/orders(?:[?#]|$)/);
        const main = page.getByRole("main");
        await expect(main.getByText("No tiene ningún producto en sus pedidos.", { exact: true })).toBeVisible();
        await expect(main.getByRole("textbox", { name: "Número de pedido", exact: true })).toBeVisible();
        await expect(main.getByRole("button", { name: "Buscar pedido", exact: true })).toBeDisabled();
        expect(await myOrders.visibleOrderCodes()).toEqual([]);
        testInfo.annotations.push({ type: "qst-order-history-state", description: "S1 authenticated API and UI confirm an empty order history." });
        return;
      }
      await expect.poll(() => myOrders.visibleOrderCodes().then((codes) => codes.length), {
      timeout: 60000,
      message: "The authenticated PE My Orders page must list an order after loading.",
      }).toBeGreaterThan(0);
    });
    const orderCodes = await myOrders.visibleOrderCodes();
    testInfo.annotations.push({
      type: "qst-order-history-count",
      description: String(orderCodes.length),
    });
  });
});
