import { test } from "@playwright/test";
import ProfilePage from "../../../../../pages/ProfilePage";
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

test.describe("PE S1 QST - guarded profile writes", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: hasPeAuthState() ? PE_AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(!process.env.PE_STOREFRONT_URL, "PE_STOREFRONT_URL is required.");
    test.skip(!hasPeAuthState(), "Authenticated PE S1 state is required.");
    test.skip(
      process.env.ALLOW_PROFILE_WRITE !== "1",
      "Set ALLOW_PROFILE_WRITE=1 only for an explicitly authorized PE S1 QA profile-address lifecycle run."
    );
    test.skip(
      !process.env.PE_ADDRESS_API_URL,
      "PE_ADDRESS_API_URL is required so QA-marked addresses can be verified and cleaned up safely."
    );
    const auth = getPeAuthState();
    await auth.applyAuthSessionStorage(context);
  });

  test("SAM-25056 @destructive @qst @pe @base-store @registered @reuse - Add edit delete addresses", async ({ page }, testInfo) => {
    test.setTimeout(420000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25056"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    const profile = new ProfilePage(page, {
      origin: config.baseUrl.origin,
      market: "pe",
      addressApiUrl: config.addressApiUrl.href,
    });

    const runId = String(Date.now());
    const created = profile.qaAddress(`PROFILE ${runId}`, testData.address);
    const updated = profile.qaAddress(`PROFILE EDITED ${runId}`, testData.address);

    try {
      await profile.deleteQaAddressesViaApi(created.street).catch(() => 0);
      await profile.deleteQaAddressesViaApi(updated.street).catch(() => 0);

      await profile.createQaAddress(created);
      await profile.waitForQaAddressViaApi(created.street);

      await profile.editQaAddress(created.street, updated);
      await profile.waitForQaAddressViaApi(updated.street);

      await profile.deleteQaAddress(updated.street);
      await profile.deleteQaAddressesViaApi(updated.street);

      testInfo.annotations.push({
        type: "qst-reuse-note",
        description: "Creates, edits and deletes only QA AUTOMATION-marked PE profile addresses; cleanup is restricted to the same QA marker via the configured S1 address API.",
      });
    } finally {
      await profile.deleteQaAddressesViaApi(created.street).catch(() => {});
      await profile.deleteQaAddressesViaApi(updated.street).catch(() => {});
    }
  });

  test("SAM-25084 @destructive @qst @pe @base-store @registered @reuse - Add Edit saved new address baseline", async ({ page }, testInfo) => {
    test.setTimeout(420000);
    recordBusinessEvidence(testInfo, getPeQstEvidenceMetadata("SAM-25084"));

    const auth = getPeAuthState();
    await auth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");

    const config = getPeS1QstConfig();
    const profile = new ProfilePage(page, {
      origin: config.baseUrl.origin,
      market: "pe",
      addressApiUrl: config.addressApiUrl.href,
    });
    const qaAddress = profile.qaAddress(`CHECKOUT ${Date.now()}`, testData.address);

    try {
      const { checkout } = await reachPeRegisteredDelivery(page, config);
      await checkout.saveNewAuthenticatedAddress(qaAddress);
      await checkout.selectShippingMethod();
      await checkout.acceptTerms();
      await checkout.continueToPayment();
      await profile.waitForQaAddressViaApi(qaAddress.street);

      testInfo.annotations.push({
        type: "qst-reuse-note",
        description:
          "The new-address Save path from registered checkout is persisted and API-read back using a QA-only marker, then cleaned up. The official Edit-existing-address path remains pending live selector proof before Full coverage.",
      });
    } finally {
      await profile.deleteQaAddressesViaApi(qaAddress.street).catch(() => {});
    }
  });
});
