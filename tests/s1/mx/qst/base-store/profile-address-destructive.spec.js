import ProfilePage from "../../../../../pages/ProfilePage";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";
import destructiveGuards from "../../../../../utils/destructiveGuards";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { requireProfileWriteOptIn } = destructiveGuards;
const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ mode: "serial", timeout: 420000 });

test.skip(process.env.ALLOW_PROFILE_WRITE !== "1", "Profile address persistence is destructive and requires ALLOW_PROFILE_WRITE=1.");

function mxAddressApiUrl(mxConfig) {
  const expectedHost = `${mxConfig.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
  const expectedPath = "/tokocommercewebservices/v2/mx/users/current/addresses";
  const url = new URL(process.env.MX_ADDRESS_API_URL?.trim() || `https://${expectedHost}${expectedPath}`);
  if (url.protocol !== "https:" || url.hostname !== expectedHost || url.pathname !== expectedPath || url.search) {
    throw new Error(`MX address API must use the ${mxConfig.environment} MX address endpoint.`);
  }
  return url.href;
}

async function reachRegisteredDeliveryViaUi(page, mxConfig) {
  // prepareMxQstCart already validates the controlled SKU/quantity from the
  // rendered cart. Do not re-read current-cart response bodies in this TC.
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.proceedToAuthenticatedCheckout();

  const checkout = new MxCheckoutPage(page);
  await checkout.fillRegisteredContact({
    firstName: "MX",
    lastName: "Automation",
    phone: "5512345678",
  });
  await checkout.validateCheckoutSummary(mxConfig.sku);
  return checkout;
}

test("SAM-24991 @destructive @qst @mx @base-store @registered - Add or edit saved/new address on checkout", async ({ page, mxConfig }, testInfo) => {
  requireProfileWriteOptIn();
  const addressApiUrl = mxAddressApiUrl(mxConfig);
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24991"));
  const profile = new ProfilePage(page, { origin: mxConfig.baseUrl.origin, market: "mx", addressApiUrl });
  const marker = `QA AUTOMATION MX QST ${Date.now()}`;
  const updatedMarker = marker.replace(" QST ", " EDT ");
  try {
    await profile.deleteQaAddressesViaApi(marker).catch(() => 0);
    const checkout = await reachRegisteredDeliveryViaUi(page, mxConfig);
    const newAddress = page.getByRole("radio", { name: /Nueva direcci[oó]n|New address/i }).filter({ visible: true }).first();
    await newAddress.waitFor({ state: "visible", timeout: 60000 });
    await newAddress.check({ force: true });
    await expect(newAddress).toBeChecked({ timeout: 30000 });
    const address = await checkout.fillDelivery({ postalCode: "01000", street: marker, exteriorNumber: "1000" }, { registered: true });
    expect(address.lookupStatus).toBe(200);
    const saveAddress = page.getByRole("checkbox", { name: /Guardar detalhes para compras futuras|Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i }).filter({ visible: true });
    await expect(saveAddress.first()).toBeVisible({ timeout: 30000 });
    await saveAddress.first().check({ force: true });
    await expect(saveAddress.first()).toBeChecked();
    await checkout.selectDeliveryAndContinue();
    await checkout.validatePaymentPage({ postalCode: "01000" });
    await profile.waitForQaAddressViaApi(marker);
    const deliverySummary = page.locator(".address-details__delivery-address").filter({ hasText: marker });
    await expect(deliverySummary, "The saved QA address must appear in the checkout delivery summary.")
      .toBeVisible({ timeout: 30000 });
    await page.locator(".delivery-item-actions a.actions__edit").first().click();
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 30000 });

    const savedAddress = page.getByText(marker, { exact: false }).filter({ visible: true }).first();
    await expect(savedAddress, "The saved QA address must be available for editing in Delivery.")
      .toBeVisible({ timeout: 30000 });
    const savedAddressCard = savedAddress.locator(
      "xpath=ancestor::*[.//a[contains(@class,'actions__edit')]][1]"
    );
    await savedAddressCard.locator("a.actions__edit").click();
    const street = page.getByRole("textbox", { name: "line2" }).filter({ visible: true }).first();
    await expect(street, "Editing the saved address must prepopulate its street.")
      .toHaveValue(marker, { timeout: 30000 });
    await street.fill(updatedMarker);
    const saveEdit = page.getByRole("button", { name: /Guardar|Save/i }).filter({ visible: true }).first();
    await expect(saveEdit, "The saved-address edit form must expose Save.").toBeVisible({ timeout: 30000 });
    await expect(saveEdit, "The edited address must pass form validation before saving.").toBeEnabled({ timeout: 30000 });
    await saveEdit.click();
    await profile.waitForQaAddressViaApi(updatedMarker);
    await expect(page.getByText(updatedMarker, { exact: false }).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    recordBusinessEvidence(testInfo, {
      addressMarker: marker,
      persisted: true,
      edited: true,
      editedAddressVisible: true,
      lookupStatus: address.lookupStatus,
    });
  } finally {
    await profile.deleteQaAddressesViaApi(marker);
    await profile.deleteQaAddressesViaApi(updatedMarker);
  }
});
