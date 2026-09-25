import { test, expect } from "@playwright/test";
import peAuthStateModule from "../../../../../utils/peAuthState";
import peConfigModule from "../../../../../config/markets/pe";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext";
import peEvidenceMetadata from "../../../../../utils/qstPeEvidenceMetadata";
import { testData } from "../../../../../utils/testData";
import { reachPeRegisteredDelivery } from "./peQstFlows";

const {
  PE_AUTH_STATE_PATH,
  getPeAuthState,
  hasPeAuthState,
} = peAuthStateModule;
const { getPeS1QstConfig } = peConfigModule;
const { recordBusinessEvidence } = evidenceContext;
const { getPeQstEvidenceMetadata } = peEvidenceMetadata;

test.describe("PE S1 QST - registered checkout safe reuse", () => {
  test.use({ storageState: hasPeAuthState() ? PE_AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required.");
    test.skip(
      !hasPeAuthState(),
      "Authenticated PE S1 state is required in the dedicated ignored PE auth artifacts."
    );
    const auth = getPeAuthState();
    await auth.applyAuthSessionStorage(context);
  });

  test("SAM-25085 @qst @pe @base-store @safe @registered @reuse - Select saved address", async ({ page }, testInfo) => {
    test.setTimeout(300000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25085"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    const { checkout } = await reachPeRegisteredDelivery(page, config);
    const savedAddressMode = page.getByRole("radio", {
      name: "Dirección guardada",
      exact: true,
    });
    test.skip(
      !(await savedAddressMode.isVisible().catch(() => false)),
      "No saved address is available in the authenticated PE S1 account; do not create persistent data in this safe TC."
    );

    await checkout.selectSavedAddressAndValidate();
    testInfo.annotations.push({
      type: "qst-reuse-note",
      description: "Read-only selection of an already-existing saved address. No address is created or edited by this safe test.",
    });
  });

  test("SAM-25086 @qst @pe @base-store @safe @registered @reuse - Save option for registered user", async ({ page }, testInfo) => {
    test.setTimeout(300000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25086"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    await reachPeRegisteredDelivery(page, config);

    const newAddress = page.getByRole("radio", {
      name: "Nueva dirección",
      exact: true,
    });
    if (await newAddress.isVisible().catch(() => false)) {
      await newAddress.check();
    }

    const saveAddress = page.getByRole("checkbox", {
      name: /Guardar datos de env[ií]o en Mi cuenta/i,
    });
    await expect(saveAddress).toBeVisible({ timeout: 30000 });

    testInfo.annotations.push({
      type: "qst-reuse-note",
      description: "The registered-user Save address option is asserted as visible without checking it or persisting account data.",
    });
  });

  test("SAM-25087 @qst @pe @base-store @safe @registered @reuse - Checkout with a new address", async ({ page }, testInfo) => {
    test.setTimeout(300000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25087"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    const { checkout } = await reachPeRegisteredDelivery(page, config);
    const newAddress = page.getByRole("radio", {
      name: "Nueva dirección",
      exact: true,
    });
    if (await newAddress.isVisible().catch(() => false)) {
      await newAddress.check();
    }

    await checkout.fillAddress(testData.address);
    await checkout.validateAddressValues(testData.address);

    const saveAddress = page.getByRole("checkbox", {
      name: /Guardar datos de env[ií]o en Mi cuenta/i,
    });
    if (await saveAddress.isVisible().catch(() => false)) {
      await expect(saveAddress).not.toBeChecked();
    }

    testInfo.annotations.push({
      type: "qst-reuse-note",
      description: "A new registered-user delivery address is populated and reflected in the checkout form without saving it or continuing to payment.",
    });
  });
});
