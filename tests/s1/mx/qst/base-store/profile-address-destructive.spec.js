import ProfilePage from "../../../../../pages/ProfilePage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { reachMxRegisteredDelivery } from "../../dst/base-store/mxFlows";

const { requireProfileWriteOptIn } = destructiveGuards;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ mode: "serial", timeout: 420000 });

test("SAM-24991 + SAM-24993 @destructive @qst @mx @base-store @registered - Persist a QA checkout address", async ({ page, mxConfig }, testInfo) => {
  requireProfileWriteOptIn();
  const addressApiUrl = process.env.MX_ADDRESS_API_URL?.trim();
  test.skip(
    !addressApiUrl,
    "MX_ADDRESS_API_URL is required so QA-marked address persistence can be read back and cleaned up safely."
  );

  recordBusinessEvidence(testInfo, {
    ...getMxQstEvidenceMetadata("SAM-24991"),
    relatedZephyrIds: ["SAM-24993"],
  });

  const profile = new ProfilePage(page, {
    origin: mxConfig.baseUrl.origin,
    market: "mx",
    addressApiUrl,
  });
  const marker = `QA AUTOMATION MX QST ${Date.now()}`;

  try {
    await profile.deleteQaAddressesViaApi(marker).catch(() => 0);
    const { checkout } = await reachMxRegisteredDelivery(page, mxConfig);

    const newAddress = page
      .getByRole("radio", { name: /Nueva direcci[oó]n|New address/i })
      .filter({ visible: true });
    if (await newAddress.count()) await newAddress.first().check();

    const address = await checkout.fillDelivery(
      {
        postalCode: "01000",
        street: marker,
        exteriorNumber: "1000",
      },
      { registered: true }
    );
    expect(address.lookupStatus).toBe(200);

    const saveAddress = page
      .getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i })
      .filter({ visible: true });
    await expect(saveAddress.first()).toBeVisible({ timeout: 30000 });
    await saveAddress.first().check({ force: true });
    await expect(saveAddress.first()).toBeChecked();

    await checkout.selectDeliveryAndContinue();
    await checkout.validatePaymentPage({ postalCode: "01000" });
    await profile.waitForQaAddressViaApi(marker);

    recordBusinessEvidence(testInfo, {
      addressMarker: marker,
      persisted: true,
      lookupStatus: address.lookupStatus,
      note: "Add/save persistence is proven. Edit-existing-address remains a separate live selector concern until MX S1 exposes the edit control during execution.",
    });
  } finally {
    await profile.deleteQaAddressesViaApi(marker).catch(() => {});
  }
});
