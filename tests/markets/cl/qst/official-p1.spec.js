import { test as base, expect } from "@playwright/test";
import HomePage from "../../../../pages/HomePage";
import CartPage from "../../../../pages/CartPage";
import clConfigModule from "../../../../config/markets/cl";
import clAuthStateModule from "../../../../utils/clAuthState";
import { addConfiguredProductToClCart, bootstrapClStorefront } from "./clQstFlows";

const test = base.extend({
  qstBusinessScenario: [async ({}, use, testInfo) => {
    const samId = testInfo.title.match(/SAM-\d+/)?.[0];
    const businessTitle = testInfo.title.includes(" - ")
      ? testInfo.title.split(" - ").slice(1).join(" - ")
      : "Execute and validate CL QST business scenario";
    await base.step(`${samId ? `${samId} · ` : ""}${businessTitle}`, async () => {
      await use();
    });
  }, { auto: true }],
});

const { getClQstConfig } = clConfigModule;
const { CL_AUTH_STATE_PATH, getClAuthState, hasClAuthState } = clAuthStateModule;

test.describe("CL QST - Official P1", () => {
  test.describe.configure({ timeout: 420000 });

  const blocked = (reason) => test.skip(true, `CL QST environment prerequisite BLOCKED: ${reason}`);
  const config = () => getClQstConfig();

  async function home(page) {
    const cfg = config();
    await bootstrapClStorefront(page, cfg);
    return cfg;
  }

  async function authenticatedPage(browser, cfg) {
    test.skip(!hasClAuthState(), "CL authenticated state is required. Run CL_QST_ENVIRONMENT=S2 npm run auth:refresh:cl first.");
    const context = await browser.newContext({ storageState: CL_AUTH_STATE_PATH });
    await getClAuthState().applyAuthSessionStorage(context);
    const page = await context.newPage();
    await bootstrapClStorefront(page, cfg);
    await page.goto(cfg.baseUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    return { context, page };
  }

  async function cart(page) {
    const cfg = config();
    const current = await addConfiguredProductToClCart(page, cfg);
    await current.validateProductInCart();
    return { cfg, cart: current };
  }

  // Base Store · 31 official P1 cases.
  test("SAM-24784 @qst @cl @base-store @registered - Login Home page", async ({ browser }) => {
    const cfg = config();
    const { context, page } = await authenticatedPage(browser, cfg);
    try {
      const profile = page.getByRole("button", { name: "My Profile", exact: true })
        .or(page.locator('button[data-an-la="L0_13_login"]'))
        .or(page.locator("button.nv00-gnb-v4__utility-user"))
        .filter({ visible: true }).first();
      await expect(profile).toBeVisible({ timeout: 60000 });
      await profile.click();
      await expect(page.getByText(/Cerrar Sesi[oó]n/i).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
  test("SAM-24785 @blocked @qst @cl @base-store @registered - Add/edit/delete addresses", async () => blocked("registered auth is wired; Chile address fixtures/selectors still need local proof before profile writes."));
  test("SAM-24786 @blocked @qst @cl @base-store @registered - My Orders page", async () => blocked("registered auth is wired; CL My Orders navigation/content still needs local proof."));

  test("SAM-24790 @qst @cl @base-store - Able to add to Cart from PDP", async ({ page }) => {
    const { cart: current } = await cart(page);
    await current.validateProductInCart();
  });

  test("SAM-24791 @qst @cl @base-store - Cart page UI", async ({ page }) => {
    const { cart: current } = await cart(page);
    await current.validateCartPage();
  });

  test("SAM-24793 @qst @cl @base-store - Order Summary on cart page", async ({ page }) => {
    const { cart: current } = await cart(page);
    await current.validateOrderSummary();
  });

  test("SAM-24794 @qst @cl @base-store - Verify rewards as a rewards user", async ({ page }) => {
    await cart(page);
    await expect(page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
  });

  test("SAM-24797 @blocked @qst @cl @base-store - Verify BOGO product on cart page", async () => blocked("eligible CL BOGO SKU/test data is required."));
  test("SAM-24803 @blocked @qst @cl @base-store - Verify Recycle & Save Trade-in on cart page", async () => blocked("eligible CL Trade-in SKU/test data is required."));
  test("SAM-24804 @blocked @qst @cl @base-store - SC+ on cart page", async () => blocked("eligible CL Samsung Care+ SKU/test data is required."));

  test("SAM-24806 @qst @cl @base-store - UI validation in desktop view", async ({ page }) => {
    const cfg = await home(page);
    const homepage = new HomePage(page, {
      setupUrl: null,
      homeUrl: cfg.baseUrl.href,
      footerHeadingPattern: /Samsung|Tienda|Shop/i,
    });
    const attributes = await homepage.validateHomepageAttributes();
    expect(attributes.headerVisible).toBe(true);
    expect(attributes.footerVisible).toBe(true);
    expect(await page.locator("img").count()).toBeGreaterThan(0);
  });

  test("SAM-24807 @blocked @qst @cl @base-store @registered - Login from Checkout page", async () => blocked("CL auth is wired; checkout-specific Samsung Account transition still needs local proof before enabling this TC."));

  test("SAM-24808 @qst @cl @base-store - Checkout button on cart page", async ({ page }) => {
    const { cart: current } = await cart(page);
    await current.proceedToCheckout();
    await expect(page).toHaveURL(/\/cl\/(guestlogin\/checkout|checkout\/one)/i, { timeout: 60000 });
  });

  test("SAM-24810 @qst @cl @base-store - Step 1 Contact Details Section", async ({ page }) => {
    const { cart: current } = await cart(page);
    await current.proceedToCheckout();
    const email = page.getByPlaceholder(/correo electr[oó]nico|email/i).first();
    if (await email.isVisible().catch(() => false)) {
      await email.fill(`cl-qst-${Date.now()}@mailinator.com`);
      const guest = page.getByRole("button", { name: /Continuar como invitado/i }).first();
      if (await guest.isVisible().catch(() => false)) await guest.click();
    }
    await expect(page).toHaveURL(/\/cl\/checkout\/one/i, { timeout: 60000 });
    await expect(page.locator('input[name="firstName"], input[formcontrolname="firstName"]').first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('input[name="lastName"], input[formcontrolname="lastName"]').first()).toBeVisible();
    await expect(page.locator('input[name="phone"], input[formcontrolname="phone"]').first()).toBeVisible();
  });

  for (const [id, title, reason] of [
    ["SAM-24811", "Add/Edit saved/new address on checkout page", "registered auth is wired; saved-address flow needs verified Chile address selectors/data."],
    ["SAM-24812", "Select saved address", "registered auth is wired; a proven CL saved-address fixture is still required."],
    ["SAM-24813", "Save option for reg user", "registered auth is wired; profile-write address flow needs local proof."],
    ["SAM-24814", "Able to checkout with a New address", "Chile shipping/billing address fixture must be proven locally."],
    ["SAM-24815", "Save option not visible", "guest checkout address controls must be stabilized before asserting this negative case."],
    ["SAM-24816", "Different billing and shipping", "Chile shipping/billing address fixture must be proven locally."],
    ["SAM-24817", "Validate home delivery", "CL delivery-mode selectors and eligible postal data must be proven locally."],
    ["SAM-24818", "Validate store pick up delivery option is available on checkout page", "CL store-pickup eligible product/address test data is required."],
    ["SAM-24819", "Validate switching between delivery modes or saved/new address", "CL auth is wired; registered address and delivery-mode fixtures still need local proof."],
  ]) {
    test(`${id} @blocked @qst @cl @base-store - ${title}`, async () => blocked(reason));
  }

  test("SAM-24821 @qst @cl @base-store - Verify Back to Top", async ({ page }) => {
    await cart(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const control = page.getByRole("button", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i })
      .or(page.getByRole("link", { name: /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i }))
      .filter({ visible: true }).first();
    await expect(control).toBeVisible({ timeout: 30000 });
    await control.click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBeLessThan(200);
  });

  for (const [id, title, reason] of [
    ["SAM-24822", "Payment using Credit / Debit card with reg user", "registered auth is wired; approved CL card-submit path/test data is still required."],
    ["SAM-24823", "Payment using Direct Bank Transfer", "Direct Bank Transfer includes a CS/BackOffice approval dependency."],
    ["SAM-24824", "Payment using Interest-free installments - Credit card / Debit Card", "CL installments payment path must be proven before destructive automation."],
    ["SAM-24825", "Payment using Rewards", "Rewards-enabled account/test data is required."],
    ["SAM-24826", "Order confirmation screen", "destructive order placement is not promoted until a CL payment flow is proven."],
    ["SAM-24830", "Backoffice", "shared BackOffice credentials can be reused; CL order-search baseline still needs local proof."],
    ["SAM-24831", "Order Process", "requires a freshly placed CL order and BackOffice Shipping Requested transition."],
  ]) {
    test(`${id} @blocked @qst @cl @base-store - ${title}`, async () => blocked(reason));
  }

  // EPP · 7 official P1 cases. Credential model is shared, but CL-specific storefront/WMC routing must be proven.
  for (const [id, title] of [
    ["SAM-24836", "Epp Login"],
    ["SAM-24840", "Able to add to Cart from PDP"],
    ["SAM-24841", "Cart page UI"],
    ["SAM-24851", "Checkout button on cart page"],
    ["SAM-24864", "Payment using credit / Debit card with reg user"],
    ["SAM-24865", "Payment using Direct Bank Transfer"],
    ["SAM-24866", "Order confirmation screen"],
  ]) {
    test(`${id} @blocked @qst @cl @epp - ${title}`, async () => blocked("shared credentials are reusable; CL EPP WMC/storefront URL and country-specific routing still need to be supplied/proven."));
  }
});
