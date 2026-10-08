import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import HomePage from "../../../../pages/HomePage";
import CartPage from "../../../../pages/CartPage";
import ProfilePage from "../../../../pages/ProfilePage";
import MyOrdersPage from "../../../../pages/MyOrdersPage";
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
const { CL_AUTH_STATE_PATH, CL_AUTH_SESSION_STORAGE_PATH, getClAuthState, hasClAuthState } = clAuthStateModule;

test.describe("CL QST - Official P1", () => {
  test.setTimeout(420000);

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
  test("SAM-24785 @destructive @qst @cl @base-store @registered - Add/edit/delete addresses", async ({ browser }) => {
    test.skip(process.env.ALLOW_PROFILE_WRITE !== "1", "Set ALLOW_PROFILE_WRITE=1 for the CL QA address lifecycle.");
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const cfg = config();
    test.skip(!cfg.setupUrl, "The CL profile-address lifecycle is configured for S2 only.");
    const context = await browser.newContext({ storageState: CL_AUTH_STATE_PATH });
    const sessionState = JSON.parse(fs.readFileSync(CL_AUTH_SESSION_STORAGE_PATH, "utf8"));
    await context.addInitScript(({ hostname, state }) => {
      if (location.hostname === hostname) {
        for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, value);
      }
    }, { hostname: cfg.baseUrl.hostname, state: sessionState });
    const page = await context.newPage();
    const profile = new ProfilePage(page, { origin: cfg.baseUrl.origin, market: "cl" });
    const runId = Date.now() % 1000000;
    const letters = (value) => String(value).padStart(6, "0").replace(/[0-9]/g, (digit) => "ABCDEFGHIJ"[Number(digit)]);
    const addressId = letters(runId);
    const editedAddressId = letters((runId + 1) % 1000000);
    const created = profile.qaAddress(addressId, {
      phone: "987654321",
      rut: "12.345.678-5",
      region: "Metropolitana de Santiago",
      commune: "Alhué",
    });
    const updated = { ...created, street: `${profile.qaMarker} ${editedAddressId}`, number: "124" };
    created.number = "123";
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto(cfg.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
          break;
        } catch (error) {
          if (attempt === 2 || !/ERR_NETWORK_CHANGED|ERR_ABORTED|ERR_CONNECTION_RESET/.test(String(error))) throw error;
        }
      }
      await page.getByText(/you can access pages now/i)
        .waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      await profile.openAddressManagement();
      await expect(page.locator('button[data-an-la="address:add"]')).toBeVisible({ timeout: 30000 });
      await profile.expandClAddressesUntil("QA AUTOMATION NEVER MATCH THIS SENTINEL");
      const staleMarkers = [...new Set((await page.getByText(/QA AUTOMATION [A-J]{6}/).allTextContents())
        .flatMap((text) => text.match(/QA AUTOMATION [A-J]{6}/g) || []))];
      for (const marker of staleMarkers) await profile.deleteQaAddress(marker);
      await test.step("Create QA-only CL address", () => profile.createQaAddress(created));
      await test.step("Edit QA-only CL address", () => profile.editQaAddress(created.street, updated));
      await test.step("Delete QA-only CL address", () => profile.deleteQaAddress(updated.street));
    } finally {
      for (const marker of [updated.street, created.street]) {
        await profile.expandClAddressesUntil(marker);
        const visible = await page.getByText(marker, { exact: false }).first().isVisible().catch(() => false);
        if (visible) await profile.deleteQaAddress(marker);
      }
      await context.close();
    }
  });
  test("SAM-24786 @qst @cl @base-store @registered - My Orders page", async ({ browser }) => {
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const cfg = config();
    const context = await browser.newContext({ storageState: CL_AUTH_STATE_PATH });
    const sessionState = JSON.parse(fs.readFileSync(CL_AUTH_SESSION_STORAGE_PATH, "utf8"));
    await context.addInitScript(({ hostname, state }) => {
      if (location.hostname === hostname) {
        for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, value);
      }
    }, { hostname: cfg.baseUrl.hostname, state: sessionState });
    const page = await context.newPage();
    const orders = new MyOrdersPage(page, { origin: cfg.baseUrl.origin, market: "cl" });
    try {
      if (cfg.setupUrl) await page.goto(cfg.setupUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await orders.openMyOrders();
      await expect(page).toHaveURL(/\/cl\/mypage\/orders/i);
      console.log(`[cl-orders] ${JSON.stringify({ url: page.url(), codes: await orders.visibleOrderCodes(), main: (await page.getByRole("main").innerText()).slice(0, 1600) })}`);
    } finally {
      await context.close();
    }
  });

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
    const email = page.getByPlaceholder(/Ingresa tu correo|correo electr[oó]nico|email/i).first();
    if (await email.isVisible().catch(() => false)) {
      await email.fill(`cl-qst-${Date.now()}@mailinator.com`);
      const reminderClose = page.locator('[class*="ins-custom-cart-reminder-container"] [class*="ins-close-button"]')
        .filter({ visible: true });
      for (let attempt = 0; attempt < 3 && await reminderClose.count(); attempt++) {
        await reminderClose.last().click();
      }
      const guest = page.getByRole("button", { name: /Compra como invitad/i }).first();
      await expect(guest).toBeVisible({ timeout: 30000 });
      await guest.click();
    }
    await expect(page).toHaveURL(/\/cl\/checkout\/one/i, { timeout: 60000 });
    await expect(page.locator('input[name="firstName"], input[formcontrolname="firstName"]').first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('input[name="lastName"], input[formcontrolname="lastName"]').first()).toBeVisible();
    await expect(page.locator('input[name="phone"], input[formcontrolname="phone"]').first()).toBeVisible();
  });

  test("SAM-24811 @qst @cl @base-store @registered - Add/Edit saved/new address on checkout page", async ({ browser }) => {
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const cfg = config();
    const context = await browser.newContext({ storageState: CL_AUTH_STATE_PATH });
    const sessionState = JSON.parse(fs.readFileSync(CL_AUTH_SESSION_STORAGE_PATH, "utf8"));
    await context.addInitScript(({ hostname, state }) => {
      if (location.hostname === hostname) {
        for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, value);
      }
    }, { hostname: cfg.baseUrl.hostname, state: sessionState });
    const page = await context.newPage();
    try {
      const current = await addConfiguredProductToClCart(page, cfg);
      await current.proceedToAuthenticatedCheckout();
      await expect(page).toHaveURL(/\/cl\/checkout\/one/i, { timeout: 60000 });
      console.log(`[cl-24811] ${JSON.stringify({ url: page.url(), radios: await page.getByRole("radio").allTextContents(), buttons: await page.getByRole("button").allTextContents() })}`);
      await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i, { timeout: 60000 });
    } finally {
      await context.close();
    }
  });

  for (const [id, title, reason] of [
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
