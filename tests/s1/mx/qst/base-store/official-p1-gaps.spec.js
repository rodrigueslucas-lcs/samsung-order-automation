import { chromium } from "@playwright/test";
import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { reachMxGuestDelivery } from "../../dst/base-store/mxFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

const PRE_QA_ORIGIN = "https://p6-pre-qa2.samsung.com";
const PRE_QA_CDP_URL = process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223";

async function getAuthenticatedPreQaPage() {
  const cdpBrowser = await chromium.connectOverCDP(PRE_QA_CDP_URL);
  const contexts = cdpBrowser.contexts();
  if (!contexts.length) {
    await cdpBrowser.close();
    throw new Error(`No Chrome context found at ${PRE_QA_CDP_URL}. Keep the authenticated PreQA2 bootstrap Chrome open.`);
  }
  const page = await contexts[0].newPage();
  return { cdpBrowser, page };
}

async function dismissLocationBanner(page) {
  const continueButton = page.getByRole("button", { name: /Continuar/i }).filter({ visible: true });
  if (await continueButton.count()) await continueButton.first().click().catch(() => {});
}

test.describe.configure({ timeout: 420000 });

test("SAM-24964 @qst @mx @base-store @safe - Store GNB matches Samsung.com", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24964"));

  const { cdpBrowser, page } = await getAuthenticatedPreQaPage();
  try {
    await page.goto(`${PRE_QA_ORIGIN}/mx/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dismissLocationBanner(page);

    if (/\/apps\/samsung\/login\//i.test(page.url())) {
      throw new Error(`The Chrome attached at ${PRE_QA_CDP_URL} is not authenticated for PreQA2.`);
    }
    await expect(page).toHaveURL(new RegExp("p6-pre-qa2\\.samsung\\.com/mx/?", "i"), { timeout: 30000 });

    // Jira SAM-24964 asks to verify the GNB and prove that a user can navigate
    // to a BC page through it. Use the real global-navigation link instead of
    // navigating directly to the PLP, so the TC validates the requested path.
    const gnb = page.locator("nav, [role='navigation'], [class*='gnb']").filter({ visible: true }).first();
    await expect(gnb, "Samsung global navigation must be displayed on the Base Store home page.").toBeVisible({ timeout: 60000 });

    const smartphonesLink = page.locator("a[href*='/mx/smartphones/all-smartphones']")
      .filter({ visible: true }).first();
    await expect(smartphonesLink, "The GNB must expose navigation to the Smartphones BC/PLP page.").toBeVisible({ timeout: 60000 });
    const gnbHref = await smartphonesLink.getAttribute("href");
    await smartphonesLink.click();

    await page.waitForURL((url) =>
      url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes("/mx/smartphones/all-smartphones"),
      { timeout: 60000 }
    );
    await dismissLocationBanner(page);
    await expect(page.getByText(/\d+\s*Resultado/i).first(), "The BC/PLP reached through the GNB must render its catalog.")
      .toBeVisible({ timeout: 90000 });

    recordBusinessEvidence(testInfo, {
      source: "PreQA Base Store GNB",
      cdpUrl: PRE_QA_CDP_URL,
      startPath: "/mx/",
      gnbVisible: true,
      navigationHref: gnbHref,
      destinationPath: "/mx/smartphones/all-smartphones/",
      bcPageReachedThroughGnb: true,
    });
  } finally {
    await page.close().catch(() => {});
    await cdpBrowser.close().catch(() => {});
  }
});

test("SAM-24968 @qst @mx @base-store @safe - PLP facets are displayed and filterable", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24968"));
  test.skip(true, "Official P1 is selected, but the MX S1 PLP/facet runtime flow is not implemented yet; do not fabricate facet coverage.");
});

test("SAM-24990 @qst @mx @base-store @safe - Fill mandatory customer details", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24990"));
  await reachMxGuestDelivery(page, mxConfig, "mx.qst.sam-24990@example.com");
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i);
  await expect(page.getByRole("region", { name: /2\. M[eé]todo de Entrega/i })).toBeVisible({ timeout: 30000 });
  recordBusinessEvidence(testInfo, { mandatoryCustomerDetailsAccepted: true, reachedDeliveryWithoutSubmit: true });
});

test("SAM-24995 @qst @mx @base-store @safe - Guest user cannot save address", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24995"));
  const { checkout } = await reachMxGuestDelivery(page, mxConfig, "mx.qst.sam-24995@example.com");
  const address = await checkout.fillDelivery({ postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" });
  expect(address.lookupStatus).toBe(200);
  const saveAddress = page.getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o|Mi cuenta)|Save.*address/i }).filter({ visible: true });
  await expect(saveAddress).toHaveCount(0);
  recordBusinessEvidence(testInfo, { guestAddressPersistenceExposed: false, profileWritePerformed: false });
});
