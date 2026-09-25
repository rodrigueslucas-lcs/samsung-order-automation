import { chromium } from "@playwright/test";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
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

    const gnb = page.locator("nav, [role='navigation'], [class*='gnb']").filter({ visible: true }).first();
    await expect(gnb, "Samsung global navigation must be displayed on the Base Store home page.").toBeVisible({ timeout: 60000 });

    const mobilesMenu = gnb.locator("a.nv00-gnb-v4__l0-menu-link[href='/mx/smartphones/all-smartphones/']");
    await expect(mobilesMenu, "The GNB must display the Móviles category.").toBeVisible();
    await mobilesMenu.click();
    const smartphonesLink = gnb.locator("a.nv00-gnb-v4__l1-menu-link[href='/mx/smartphones/all-smartphones/']")
      .filter({ visible: true }).first();
    await expect(smartphonesLink, "The GNB must expose navigation to the Smartphones BC/PLP page.").toBeVisible({ timeout: 60000 });
    const gnbHref = await smartphonesLink.getAttribute("href");
    await smartphonesLink.click();

    await page.waitForURL((url) =>
      url.hostname === "p6-pre-qa2.samsung.com" && url.pathname.includes("/mx/smartphones/all-smartphones"),
      { timeout: 60000, waitUntil: "domcontentloaded" }
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

  const { cdpBrowser, page } = await getAuthenticatedPreQaPage();
  try {
    await page.goto(`${PRE_QA_ORIGIN}/mx/smartphones/all-smartphones/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await dismissLocationBanner(page);

    if (/\/apps\/samsung\/login\//i.test(page.url())) {
      throw new Error(`The Chrome attached at ${PRE_QA_CDP_URL} is not authenticated for PreQA2.`);
    }

    const resultCount = page.getByText(/\d+\s*Resultado/i).first();
    await expect(resultCount, "The Smartphones PLP must finish loading before validating facets.")
      .toBeVisible({ timeout: 90000 });
    const initialResultText = (await resultCount.textContent())?.trim() || "";
    const initialCount = Number(initialResultText.match(/\d+/)?.[0]);
    expect(initialCount, "The unfiltered PLP must show a numeric result count.").toBeGreaterThan(0);

    const productRange = page.getByRole("button", { name: "Gama de productos" });
    await expect(productRange, "The PLP must display its product-range facet.").toBeVisible({ timeout: 60000 });
    await productRange.click();
    const galaxyZ = page.locator("input.checkbox-v3__input[data-reg-name='galaxy-z']");
    await expect(page.locator("label[for='checkbox-series01i05']"), "Galaxy Z must be an available product-range option.").toBeVisible();
    await page.locator("label[for='checkbox-series01i05']").click();

    await expect(page).toHaveURL(/\/mx\/smartphones\/all-smartphones\/\?[^#]*galaxy-z/i, { timeout: 60000 });
    await expect(galaxyZ, "The chosen facet must remain selected.").toBeChecked();
    await expect.poll(async () => Number(((await resultCount.textContent()) || "").match(/\d+/)?.[0]), {
      message: "Selecting Galaxy Z must reduce the PLP result count.",
      timeout: 60000,
    }).toBeLessThan(initialCount);

    const filteredResultText = (await resultCount.textContent())?.trim() || "";

    recordBusinessEvidence(testInfo, {
      source: "PreQA Smartphones PLP",
      cdpUrl: PRE_QA_CDP_URL,
      plpPath: "/mx/smartphones/all-smartphones/",
      facet: "Galaxy Z",
      facetDisplayed: true,
      facetApplied: true,
      initialResultText,
      filteredResultText,
    });
  } finally {
    await page.close().catch(() => {});
    await cdpBrowser.close().catch(() => {});
  }
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
