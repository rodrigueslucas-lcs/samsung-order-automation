import { test, expect } from "@playwright/test";
import eppConfigModule from "../../../../../config/markets/epp";
import { addConfiguredEppProduct, openEppStore, validateBackToTop, validateEppCartUi } from "../../../../../flows/eppStorefront";

const { getEppConfig } = eppConfigModule;
const cfg = () => getEppConfig("MX");

function requireProductConfig(current) {
  test.skip(!current.pdpUrl || !current.sku, "MX EPP product/cart scenarios require MX_EPP_QST_PDP_URL and MX_EPP_QST_SKU when the supplied environment URL is not already a PDP.");
}

test.describe("MX QST - Official EPP", () => {
  test.describe.configure({ timeout: 420000 });

  test("SAM-25020 @qst @mx @epp @safe - Facets/Filter on PLP", async ({ page }) => {
    await test.step("Open the official MX EPP storefront and validate PLP filtering entry point", async () => {
      const current = cfg();
      const plp = String(process.env.MX_EPP_QST_PLP_URL || "").trim();
      test.skip(!plp, "MX_EPP_QST_PLP_URL is required to prove the official EPP PLP facet scenario without guessing a category route.");
      await openEppStore(page, { ...current, entryUrl: new URL(plp) });
      const filter = page.getByRole("button", { name: /Filtrar|Filtro|Filter/i })
        .or(page.getByText(/Filtrar|Filtro|Filter/i))
        .filter({ visible: true }).first();
      await expect(filter).toBeVisible({ timeout: 60000 });
    });
  });

  test("SAM-25021 @qst @mx @epp @safe - Able to add to Cart from PDP", async ({ page }) => {
    await test.step("Add the configured official MX EPP product from PDP to cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.validateProductInCart();
    });
  });

  test("SAM-25022 @qst @mx @epp @safe - Cart page UI", async ({ page }) => {
    await test.step("Validate official MX EPP cart product, summary and footer", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateEppCartUi(cart);
    });
  });

  test("SAM-25034 @qst @mx @epp @safe - Step 1: Contact information", async ({ page }) => {
    await test.step("Reach MX EPP checkout and validate the contact-information section", async () => {
      const current = cfg();
      requireProductConfig(current);
      const cart = await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await cart.proceedToCheckout();
      await expect(page).toHaveURL(/checkout|guestlogin|login|account/i, { timeout: 60000 });
      const contact = page.getByPlaceholder(/correo|email|nombre|name|tel[eé]fono|phone/i)
        .or(page.locator('input[name="firstName"], input[name="lastName"], input[name="phone"], input[type="email"]'))
        .filter({ visible: true }).first();
      await expect(contact).toBeVisible({ timeout: 60000 });
    });
  });

  test("SAM-25044 @qst @mx @epp @safe - Verify Back to Top", async ({ page }) => {
    await test.step("Validate Back to Top on the official MX EPP cart", async () => {
      const current = cfg();
      requireProductConfig(current);
      await addConfiguredEppProduct(page, current, { currencyPattern: /\$\s*[\d.,]+/ });
      await validateBackToTop(page);
    });
  });

  test("SAM-25045 @blocked @destructive @qst @mx @epp @registered - Payment using credit card with reg user", async () => {
    await test.step("Keep the official MX EPP card-payment case represented without submitting an unapproved order", async () => {
      test.skip(true, "MX EPP card payment requires authenticated EPP checkout plus explicit ALLOW_PAYMENT_SUBMIT authorization and approved card/order handling.");
    });
  });

  test("SAM-25046 @blocked @destructive @qst @mx @epp - Pay in Cash", async () => {
    await test.step("Keep the official MX EPP cash-payment case represented without placing an order", async () => {
      test.skip(true, "MX EPP Pay in Cash requires a runtime-proven EPP checkout/payment path and explicit order authorization.");
    });
  });
});
