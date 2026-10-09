import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import HomePage from "../../../../../pages/HomePage";
import CartPage from "../../../../../pages/CartPage";
import ProfilePage from "../../../../../pages/ProfilePage";
import MyOrdersPage from "../../../../../pages/MyOrdersPage";
import BackOfficeSearchPage from "../../../../../pages/BackOfficeSearchPage";
import MarketPaymentPage from "../../../../../pages/MarketPaymentPage";
import clConfigModule from "../../../../../config/markets/cl";
import clAuthStateModule from "../../../../../utils/clAuthState";
import backofficeCredentialsModule from "../../../../../utils/backofficeAdminCredentials";
import mxTestCard from "../../../../../utils/mxTestCard";
import clSamsungCredentials from "../../../../../utils/clSamsungCredentials";
import { addConfiguredProductToClCart, bootstrapClStorefront } from "../../../../../flows/cl/qstFlows";

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
const { getBackOfficeAdminCredentials } = backofficeCredentialsModule;
const { getMxTestCard } = mxTestCard;
const checkoutLoginTest = test.extend({ trace: "off", screenshot: "off", video: "off" });

test.describe("CL QST - Base Store Official P1", () => {
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

  async function clRegisteredDelivery(browser, { singleItem = false } = {}) {
    const cfg = config();
    const { context, page } = await authenticatedPage(browser, cfg);
    await page.goto(cfg.cartUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    const existingProduct = await page.getByText(cfg.sku, { exact: true }).first()
      .waitFor({ state: "visible", timeout: 20000 }).then(() => true, () => false);
    const current = existingProduct
      ? new CartPage(page, { cartUrl: cfg.cartUrl.href, sku: cfg.sku, productNamePattern: null, checkoutButtonPattern: /^Continuar$/i })
      : await addConfiguredProductToClCart(page, cfg);
    if (singleItem) {
      const quantity = page.getByRole("textbox", { name: "Quantity" }).filter({ visible: true });
      await expect(quantity).toHaveCount(1, { timeout: 30000 });
      const initial = Number(await quantity.inputValue());
      expect(initial, "CL order test requires one controlled cart row with 1–20 units before normalization").toBeGreaterThanOrEqual(1);
      expect(initial).toBeLessThanOrEqual(20);
      const decrease = page.getByRole("button", { name: "-", exact: true }).filter({ visible: true });
      for (let count = initial; count > 1; count -= 1) {
        await decrease.click();
        await current.waitForQuantityValue(quantity, String(count - 1));
      }
      await expect(quantity).toHaveValue("1");
    }
    await current.proceedToAuthenticatedCheckout();
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i, { timeout: 60000 });
    await page.getByText(/Direcci[oó]n de despacho/i).filter({ visible: true }).first()
      .waitFor({ state: "visible", timeout: 60000 });
    return { context, page };
  }

  async function clGuestDelivery(page) {
    const { cart: current } = await cart(page);
    await current.proceedToCheckout();
    const email = page.getByPlaceholder(/Ingresa tu correo|correo electr[oó]nico|email/i).first();
    await expect(email).toBeVisible({ timeout: 30000 });
    await email.fill(`cl-qst-${Date.now()}@mailinator.com`);
    await page.getByRole("button", { name: /Compra como invitad/i }).first().click();
    await expect(page).toHaveURL(/CHECKOUT_STEP_CONTACT_INFO/i, { timeout: 60000 });
    await page.locator('input[name="firstName"]').first().fill("Cliente");
    await page.locator('input[name="lastName"]').first().fill("Prueba");
    await page.locator('input[name="phone"]').first().fill("987654321");
    const document = page.locator('input[name="vatNumber"]:visible');
    if (await document.count()) await document.first().fill("12345678-5");
    await page.getByRole("button", { name: /Continuar a despacho/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i, { timeout: 60000 });
    await page.getByText(/Direcci[oó]n de despacho/i).filter({ visible: true }).first()
      .waitFor({ state: "visible", timeout: 60000 });
    await expect(page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"] input[name="line2"]:visible').first())
      .toBeVisible({ timeout: 60000 });
  }

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
    await page.setViewportSize({ width: 1440, height: 900 });
    const cfg = await home(page);
    const homepage = new HomePage(page, {
      setupUrl: null,
      homeUrl: cfg.baseUrl.href,
      homeLinkName: "Página Principal",
      footerHeadingPattern: /Samsung|Tienda|Shop/i,
    });
    const attributes = await homepage.validateHomepageAttributes();
    expect(attributes.headerVisible).toBe(true);
    expect(attributes.footerVisible).toBe(true);
    expect(await page.locator("img").count()).toBeGreaterThan(0);
  });

  {
    const test = checkoutLoginTest;
    test("SAM-24807 @qst @cl @base-store @registered - Login from Checkout page", async ({ browser }, testInfo) => {
      expect(hasClAuthState(), "Refresh the legitimate CL Samsung Account session before this login scenario.").toBe(true);
      const cfg = config();
      const state = JSON.parse(fs.readFileSync(CL_AUTH_STATE_PATH, "utf8"));
      const accountHosts = new Set(["account.samsung.com", "sts.secsso.net", "wds.samsung.com"]);
      const context = await browser.newContext({
        storageState: { cookies: state.cookies.filter(cookie => accountHosts.has(cookie.domain.replace(/^\./, ""))), origins: [] },
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      try {
        const maximize = async () => {
          await page.bringToFront();
          const cdp = await context.newCDPSession(page);
          try {
            const { windowId } = await cdp.send("Browser.getWindowForTarget");
            await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
            await expect.poll(async () => {
              const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
              return bounds.windowState;
            }, { timeout: 5000, message: "CL checkout login requires a maximized Chrome window." }).toBe("maximized");
          } finally {
            await cdp.detach();
          }
        };
        await maximize();
        page.on("framenavigated", frame => {
          if (frame === page.mainFrame()) void maximize().catch(() => {});
        });
        const { cart: current } = await cart(page);
        await current.proceedToCheckout();
        await expect(page).toHaveURL(/\/cl\/guestlogin\/checkout/i, { timeout: 60000 });
        const login = page.getByRole("button", { name: /Samsung Checkout Express|Iniciar sesi[oó]n/i }).filter({ visible: true });
        await expect(login).toHaveCount(1, { timeout: 30000 });
        let samsungAccountReached = false;
        page.on("framenavigated", frame => {
          if (frame === page.mainFrame() && new URL(frame.url()).hostname === "account.samsung.com") samsungAccountReached = true;
        });
        await login.click();
        await expect.poll(() => samsungAccountReached, { timeout: 60000, message: "Checkout login must visit legitimate Samsung Account." }).toBe(true);
        const credentials = clSamsungCredentials.readClSamsungCredentials();
        expect(Boolean(credentials.email && credentials.password), "Legitimate CL Samsung Account credentials are required for checkout login.").toBe(true);
        const email = page.locator('input#account, input[type="email"], input[name="userId"], input[name="email"]').filter({ visible: true }).first();
        await email.waitFor({ state: "visible", timeout: 60000 });
        await email.fill(credentials.email);
        const next = page.getByRole("button", { name: /Siguiente|Continuar|Next|Sign in/i }).filter({ visible: true }).first();
        await next.click();
        const password = page.locator('input[type="password"]').filter({ visible: true }).first();
        const passwordReady = await password.waitFor({ state: "visible", timeout: 15000 }).then(() => true, () => false);
        if (!passwordReady) {
          const captchaVisible = await page.locator("iframe").evaluateAll(frames => frames.some(frame => {
            const bounds = frame.getBoundingClientRect();
            return /reCAPTCHA/i.test(frame.title) && /desaf[ií]o|challenge|expira|expires/i.test(frame.title) && bounds.width > 0 && bounds.height > 0;
          }));
          if (!captchaVisible) throw new Error("Samsung Account did not advance from email to password; no visible CAPTCHA challenge was detected.");
          if (process.env.CI) throw new Error("Samsung Account requires an interactive CAPTCHA during checkout login; CI cannot complete this human verification.");
          await page.bringToFront();
          console.log("[cl-checkout-login] CAPTCHA visible: complete it manually in the maximized Chrome and click Siguiente; the test will resume automatically.");
          await password.waitFor({ state: "visible", timeout: 180000 });
        }
        await password.fill(credentials.password);
        console.log("[cl-checkout-login] Password step reached; submitting legitimate primary-account login.");
        await page.getByRole("button", { name: /Iniciar sesi[oó]n|Sign in|Continuar/i }).filter({ visible: true }).last().click();
        console.log("[cl-checkout-login] Login submitted; waiting for authenticated CL checkout.");
        await page.waitForURL(url => url.hostname === cfg.baseUrl.hostname && /\/cl\/checkout\/one/i.test(url.pathname), { timeout: 60000 }).catch(() => {
          return page.evaluate(() => {
            const text = document.body?.innerText || "";
            return {
              host: location.hostname,
              passwordRejected: /contrase[ñn]a incorrecta|incorrect password|invalid password|password is incorrect/i.test(text),
              verificationRequired: /verificaci[oó]n en dos pasos|two.step verification|c[oó]digo de verificaci[oó]n|verification code/i.test(text),
              consentRequired: /aceptar todo|agree to all|t[eé]rminos y condiciones/i.test(text),
              passwordVisible: [...document.querySelectorAll('input[type="password"]')].some(input => input.getBoundingClientRect().height > 0),
            };
          }).then(status => {
            throw new Error(`Samsung Account did not return to CL checkout. Safe login diagnostics: ${JSON.stringify(status)}`);
          });
        });
        await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i, { timeout: 60000 });
        await expect(page.getByText(/Direcci[oó]n de despacho/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
        const checkoutUrl = page.url();
        await bootstrapClStorefront(page, cfg);
        await maximize();
        await getClAuthState().validateCurrentPageAuthenticated(page);
        await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i, { timeout: 60000 });
        await expect(page.getByText(/Direcci[oó]n de despacho/i).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
      } finally {
        if (new URL(page.url()).hostname === cfg.baseUrl.hostname) {
          await page.screenshot({ fullPage: true }).then(body => testInfo.attach("cl-checkout-login", { body, contentType: "image/png" })).catch(() => {});
        }
        await context.close();
      }
    });
  }

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

  test("SAM-24811 @destructive @qst @cl @base-store @registered - Add/Edit saved/new address on checkout page", async ({ browser }) => {
    test.skip(process.env.ALLOW_PROFILE_WRITE !== "1", "Set ALLOW_PROFILE_WRITE=1 for the CL checkout address lifecycle.");
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
    const marker = `QA AUTOMATION ${String(Date.now() % 1000000).padStart(6, "0").replace(/[0-9]/g, (digit) => "ABCDEFGHIJ"[Number(digit)])}`;
    const profile = new ProfilePage(page, { origin: cfg.baseUrl.origin, market: "cl" });
    try {
      await bootstrapClStorefront(page, cfg);
      await page.goto(cfg.cartUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      const existingProduct = await page.getByText(cfg.sku, { exact: true }).first()
        .waitFor({ state: "visible", timeout: 20000 }).then(() => true, () => false);
      const current = existingProduct
        ? new CartPage(page, { cartUrl: cfg.cartUrl.href, sku: cfg.sku, productNamePattern: null, checkoutButtonPattern: /^Continuar$/i })
        : await addConfiguredProductToClCart(page, cfg);
      await current.proceedToAuthenticatedCheckout();
      await expect(page).toHaveURL(/\/cl\/checkout\/one/i, { timeout: 60000 });
      await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i, { timeout: 60000 });
      await page.getByText(/Direcci[oó]n de despacho/i).filter({ visible: true }).first()
        .waitFor({ state: "visible", timeout: 60000 });
      const newAddress = page.getByRole("radio", { name: /A[nñ]adir nueva direcci[oó]n/i });
      await newAddress.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(newAddress).toBeChecked();
      const shipping = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
      const select = async (name, option) => {
        await shipping.locator(`mat-select[name="${name}"]:not([aria-disabled="true"])`).first().click();
        await page.getByRole("option", { name: option }).first().click();
      };
      await select("regionIso", /Metropolitana/i);
      await select("town", /Alhu[eé]/i);
      await shipping.locator('input[name="line2"]:visible').first().fill(marker);
      await shipping.locator('input[name="line1"]:visible').first().fill("123");
      const save = shipping.locator('input[name="saveInAddressBook"]:visible').first();
      await expect(save).toBeEnabled();
      if (!(await save.isChecked())) {
        await save.locator('xpath=ancestor::mat-checkbox[1]')
          .getByText(/Guardar direcci[oó]n para una pr[oó]xima compra/i).click();
      }
      if (!(await save.isChecked())) {
        const invalid = await shipping.locator('.ng-invalid[name]').evaluateAll((els) => els.map((el) => ({ name: el.getAttribute("name"), value: el.value })));
        throw new Error(`CL checkout did not keep Save address checked; invalid=${JSON.stringify(invalid)}`);
      }
      const deliveryOption = shipping.locator('input[name="group0delivery_mode_option"]:visible').first();
      if (await deliveryOption.count()) {
        await deliveryOption.locator('xpath=ancestor::mat-radio-button[1]').click();
        await expect(deliveryOption).toBeChecked();
      }
      const terms = shipping.locator('input[name="termsAndCondition"]:visible');
      if (!(await terms.isChecked())) await terms.check({ force: true });
      await expect(terms).toBeChecked();
      const continueButton = page.getByRole("button", { name: /Continuar al pago/i });
      await expect(continueButton).toBeEnabled({ timeout: 30000 });
      await continueButton.click();
      await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i, { timeout: 60000 });
      await profile.openAddressManagement();
      await profile.expandClAddressesUntil(marker);
      await profile.expectQaAddress(marker);
      console.log(`[cl-24811] QA checkout address persisted and payment step reached.`);
    } finally {
      await profile.openAddressManagement().catch(() => {});
      await profile.expandClAddressesUntil(marker).catch(() => {});
      if (await page.getByText(marker, { exact: false }).first().isVisible().catch(() => false)) {
        await profile.deleteQaAddress(marker);
      }
      await context.close();
    }
  });

  test("SAM-24812 @qst @cl @base-store @registered - Select saved address", async ({ browser }) => {
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const { context, page } = await clRegisteredDelivery(browser);
    try {
      const savedMode = page.getByRole("radio", { name: /Mis direcciones/i });
      await expect(savedMode).toBeVisible({ timeout: 30000 });
      await savedMode.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(savedMode).toBeChecked();
      const savedAddresses = page.locator('input[name="addressOptionShipping"][value="SAVED_ADDRESS"]')
        .locator('xpath=ancestor::*[contains(@class,"delivery") or contains(@class,"address")][1]');
      await expect(savedAddresses).toBeVisible();
      await expect(page.getByText(/Direcci[oó]n de despacho/i).filter({ visible: true }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("SAM-24813 @qst @cl @base-store @registered - Save option for reg user", async ({ browser }) => {
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const { context, page } = await clRegisteredDelivery(browser);
    try {
      const newAddress = page.getByRole("radio", { name: /A[nñ]adir nueva direcci[oó]n/i });
      await newAddress.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(newAddress).toBeChecked();
      await expect(page.getByRole("checkbox", { name: /Guardar direcci[oó]n para una pr[oó]xima compra/i }))
        .toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });

  test("SAM-24814 @qst @cl @base-store @registered - Able to checkout with a New address", async ({ browser }) => {
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const { context, page } = await clRegisteredDelivery(browser);
    try {
      const newAddress = page.getByRole("radio", { name: /A[nñ]adir nueva direcci[oó]n/i });
      await newAddress.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(newAddress).toBeChecked();
      const shipping = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
      await shipping.locator('mat-select[name="regionIso"]:not([aria-disabled="true"])').first().click();
      await page.getByRole("option", { name: /Metropolitana/i }).first().click();
      await shipping.locator('mat-select[name="town"]:not([aria-disabled="true"])').first().click();
      await page.getByRole("option", { name: /Alhu[eé]/i }).first().click();
      await shipping.locator('input[name="line2"]:visible').first().fill("QA AUTOMATION CHECKOUT");
      await shipping.locator('input[name="line1"]:visible').first().fill("123");
      const save = shipping.locator('input[name="saveInAddressBook"]:visible').first();
      if (await save.isChecked()) await save.uncheck({ force: true });
      await expect(save).not.toBeChecked();
      const deliveryOption = shipping.locator('input[name="group0delivery_mode_option"]:visible').first();
      if (await deliveryOption.count()) {
        await deliveryOption.locator('xpath=ancestor::mat-radio-button[1]').click();
        await expect(deliveryOption).toBeChecked();
      }
      const terms = shipping.locator('input[name="termsAndCondition"]:visible');
      if (!(await terms.isChecked())) await terms.check({ force: true });
      await expect(terms).toBeChecked();
      await page.getByRole("button", { name: /Continuar al pago/i }).click();
      await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i, { timeout: 60000 });
    } finally {
      await context.close();
    }
  });

  test("SAM-24819 @qst @cl @base-store @registered - Validate switching between delivery modes or saved/new address", async ({ browser }) => {
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const { context, page } = await clRegisteredDelivery(browser);
    try {
      const saved = page.getByRole("radio", { name: /Mis direcciones/i });
      const fresh = page.getByRole("radio", { name: /A[nñ]adir nueva direcci[oó]n/i });
      await saved.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(saved).toBeChecked();
      await fresh.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(fresh).toBeChecked();
      await expect(page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"] input[name="line2"]:visible').first()).toBeVisible();
      await saved.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(saved).toBeChecked();
      await expect(fresh).not.toBeChecked();
    } finally {
      await context.close();
    }
  });

  test("SAM-24815 @qst @cl @base-store @guest - Save option not visible", async ({ page }) => {
    await clGuestDelivery(page);
    await expect(page.locator('input[name="saveInAddressBook"]:visible')).toHaveCount(0);
    await expect(page.getByText(/Guardar direcci[oó]n para una pr[oó]xima compra/i).filter({ visible: true })).toHaveCount(0);
  });

  test("SAM-24817 @qst @cl @base-store @guest - Validate home delivery", async ({ page }) => {
    await clGuestDelivery(page);
    const shipping = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
    const homeDelivery = shipping.getByText(/^Env[ií]o$/i).filter({ visible: true }).first();
    await expect(homeDelivery).toBeVisible();
    await homeDelivery.click();
    await expect(shipping.locator('input[name="line2"]:visible').first()).toBeVisible();
    await expect(shipping.locator('mat-select[name="regionIso"]:visible').first()).toBeVisible();
  });

  test("SAM-24818 @qst @cl @base-store @guest - Validate store pick up delivery option is available on checkout page", async ({ page }) => {
    await clGuestDelivery(page);
    const pickup = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]')
      .getByText(/Retiro en tienda/i).filter({ visible: true }).first();
    await expect(pickup).toBeVisible({ timeout: 30000 });
    await pickup.click();
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i);
    await expect(pickup).toBeVisible();
  });

  test("SAM-24816 @qst @cl @base-store @guest - Different billing and shipping", async ({ page }) => {
    await clGuestDelivery(page);
    const shipping = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
    await shipping.locator('mat-select[name="regionIso"]:visible').first().click();
    await page.getByRole("option", { name: /Metropolitana/i }).first().click();
    await shipping.locator('mat-select[name="town"]:visible').first().click();
    await page.getByRole("option", { name: /Alhu[eé]/i }).first().click();
    await shipping.locator('input[name="line2"]:visible').first().fill("QA AUTOMATION SHIPPING");
    await shipping.locator('input[name="line1"]:visible').first().fill("123");
    await shipping.getByText(/^Factura$/i).filter({ visible: true }).first().click();
    const billing = shipping.locator("app-billing-address-v2");
    await expect(billing).toBeVisible({ timeout: 30000 });
    const sameAsShipping = billing.locator('input[name="sameAsShipping"]');
    if (await sameAsShipping.isChecked()) await sameAsShipping.uncheck({ force: true });
    await billing.locator('input[name="companyId"]:visible').fill("12345678-5");
    await billing.locator('input[name="companyName"]:visible').fill("QA AUTOMATION LTDA");
    await billing.locator('input[name="commercializeTxt"]:visible').fill("Tecnologia");
    await billing.locator('input[name="phone"]:visible').fill("987654321");
    await billing.locator('mat-select[name="regionIso"]:visible').click();
    await page.getByRole("option", { name: /Metropolitana/i }).first().click();
    await billing.locator('mat-select[name="town"]:visible').click();
    await page.getByRole("option", { name: /Alhu[eé]/i }).first().click();
    await billing.locator('input[name="line2"]:visible').fill("QA AUTOMATION BILLING");
    await billing.locator('input[name="line1"]:visible').fill("124");
    await expect(sameAsShipping).not.toBeChecked();
    await expect(shipping.locator('input[name="line2"]:visible').first()).toHaveValue("QA AUTOMATION SHIPPING");
    await expect(billing.locator('input[name="line2"]:visible')).toHaveValue("QA AUTOMATION BILLING");
    await expect(billing.locator('input[name="line1"]:visible')).toHaveValue("124");
  });

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

  test("SAM-24830 @qst @cl @base-store @backoffice - Backoffice", async ({ page }) => {
    const cfg = config();
    const environment = cfg.environment.toLowerCase();
    process.env.BACKOFFICE_ENV = environment;
    const credentials = getBackOfficeAdminCredentials({ ...process.env, BACKOFFICE_ENV: environment });
    test.skip(!credentials.password, `Shared ${cfg.environment} BackOffice Admin credentials are required.`);
    const backOffice = new BackOfficeSearchPage(page);
    await backOffice.login({ ...credentials, authority: "admin" });
    await backOffice.expectPerspective("admin");
    await backOffice.openAdminOrders();
    const search = await backOffice.ensureAdminBasicSearch();
    await search.fill("CL");
    await backOffice.waitForZkUpdate(() => search.locator("xpath=../..")
      .locator('button[title="Search"]').click());
    const row = page.getByRole("row", { name: /Order Nr\.: CL\d{6}-\d{8}/i }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    const orderCode = (await row.innerText()).match(/\bCL\d{6}-\d{8}(?:_\d+)?\b/i)?.[0];
    expect(orderCode).toBeTruthy();
    await backOffice.openAdminOrders();
    await expect(await backOffice.searchAdminOrderAdvanced(orderCode)).toBeVisible();
    await backOffice.openAdminOrders();
    await backOffice.openAdminOrderByCode(orderCode);
    expect(await backOffice.readOpenAdminOrderStatus(orderCode)).toBeTruthy();
    await backOffice.validateProductBasicAndAdvancedSearch(cfg.sku);
    console.log(`[cl-qst] S2 BackOffice order and product search validated: ${orderCode}`);
  });

  test("SAM-24831 @qst @cl @base-store @backoffice - Order Process", async ({ page }) => {
    const cfg = config();
    const environment = cfg.environment.toLowerCase();
    process.env.BACKOFFICE_ENV = environment;
    const credentials = getBackOfficeAdminCredentials({ ...process.env, BACKOFFICE_ENV: environment });
    test.skip(!credentials.password, `Shared ${cfg.environment} BackOffice Admin credentials are required.`);
    const orderCode = String(process.env.CL_QST_ORDER_CODE || "CL261008-78229903").trim();
    expect(orderCode).toMatch(/^CL\d{6}-\d{8}(?:_\d+)?$/i);
    const backOffice = new BackOfficeSearchPage(page);
    await backOffice.login({ ...credentials, authority: "admin" });
    await backOffice.expectPerspective("admin");
    await backOffice.openAdminOrders();
    const row = await backOffice.searchAdminOrderAdvanced(orderCode);
    await backOffice.openAdminOrderByCode(orderCode, row);
    const status = await backOffice.readOpenAdminOrderStatus(orderCode);
    console.log(`[cl-qst] S2 BackOffice order ${orderCode} status: ${status}`);
    expect(status.replace(/_/g, " ").trim().toLowerCase()).toBe("shipping requested");
  });

  test("SAM-24826 @destructive @qst @cl @base-store @registered - Order confirmation screen", async ({ browser }, testInfo) => {
    test.skip(process.env.ALLOW_PAYMENT_SUBMIT !== "1", "Set ALLOW_PAYMENT_SUBMIT=1 to authorize a CL test order.");
    test.skip(!hasClAuthState(), "CL authenticated state is required.");
    const { context, page } = await clRegisteredDelivery(browser, { singleItem: true });
    try {
      const saved = page.getByRole("radio", { name: /Mis direcciones/i });
      await saved.locator("xpath=ancestor::mat-radio-button[1]").click();
      await expect(saved).toBeChecked();
      const shipping = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
      const deliveryOption = shipping.getByText(/Entrega d[ií]a siguiente|Despacho est[aá]ndar/i).filter({ visible: true }).first();
      await expect(deliveryOption).toBeVisible({ timeout: 30000 });
      await deliveryOption.click();
      const terms = shipping.locator('input[name="termsAndCondition"]:visible');
      if (!(await terms.isChecked())) await terms.check({ force: true });
      await page.getByRole("button", { name: /Continuar al pago/i }).click();
      await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i, { timeout: 60000 });

      const payment = new MarketPaymentPage(page, { market: "CL" });
      const card = getMxTestCard();
      await payment.selectCreditCard();
      await payment.fillCardData(card);
      await payment.validateCreditCardReady(card);
      const result = await payment.placeOrderAndCapture();
      expect(result.orderCode).toMatch(/^CL\d{6}-\d{8}(?:_\d+)?$/i);
      await expect(page).toHaveURL(/confirmation|confirmacion|order-confirmation|checkout\/order|success/i, { timeout: 90000 });
      await expect(page.getByText(result.orderCode, { exact: false }).first()).toBeVisible({ timeout: 30000 });
      testInfo.annotations.push({ type: "cl-qst-order", description: result.orderCode });
    } finally {
      await context.close();
    }
  });

  for (const [id, title, reason] of [
    ["SAM-24822", "Payment using Credit / Debit card with reg user", "registered auth is wired; approved CL card-submit path/test data is still required."],
    ["SAM-24823", "Payment using Direct Bank Transfer", "Direct Bank Transfer includes a CS/BackOffice approval dependency."],
    ["SAM-24824", "Payment using Interest-free installments - Credit card / Debit Card", "CL installments payment path must be proven before destructive automation."],
    ["SAM-24825", "Payment using Rewards", "Rewards-enabled account/test data is required."],
  ]) {
    test(`${id} @blocked @qst @cl @base-store - ${title}`, async () => blocked(reason));
  }
});
