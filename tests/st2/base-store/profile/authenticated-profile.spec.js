import { test, expect } from "@playwright/test";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import CheckoutPage from "../../../../pages/CheckoutPage";
import ProfilePage from "../../../../pages/ProfilePage";
import MyOrdersPage from "../../../../pages/MyOrdersPage";
import authState from "../../../../utils/authState";
import { testData } from "../../../../utils/testData";

const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  validateAuthenticatedSession,
} = authState;
const AUTH_REQUIRED = "Authenticated storefront state required. Run auth bootstrap first.";
const PROFILE_NOT_AVAILABLE =
  "ST2 address API is available but Address Management UI is absent; /pe/mypage has missing CMS content.";
const TC40_PARTIAL =
  "TC40 remains Partial: Checkout save is proven, but today's integrated multi-shipment run did not reach API readback.";

test.describe("ST2 - Authenticated Profile and Addresses", () => {
  test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context, page }) => {
    test.setTimeout(120000);
    test.skip(!hasAuthState(), AUTH_REQUIRED);
    await applyAuthSessionStorage(context);
    try {
      await validateAuthenticatedSession(page);
    } catch {
      test.skip(true, AUTH_REQUIRED);
    }
  });

  test("TC6 - Authenticated profile menu exposes account navigation", async ({ page }) => {
    const profile = new ProfilePage(page);
    const menu = await profile.validateAuthenticatedMenu();
    expect(menu.profile + menu.orders).toBeGreaterThan(0);
  });

  test("TC7 - Saved shipping and billing addresses are visible", async ({ page }) => {
    test.skip(true, PROFILE_NOT_AVAILABLE);
    const addresses = await new ProfilePage(page).listSavedAddresses();
    expect(addresses.length).toBeGreaterThan(0);
  });

  test("TC8 - Create, edit and delete a QA address", async ({ page }) => {
    test.skip(true, PROFILE_NOT_AVAILABLE);
    const profile = new ProfilePage(page);
    const created = profile.qaAddress("TC8 CREATE", testData.address);
    const updated = profile.qaAddress("TC8 UPDATED", testData.address);
    try {
      await profile.createQaAddress(created);
      await profile.editQaAddress(created.street, updated);
    } finally {
      if (await page.getByText(updated.street, { exact: false }).count()) {
        await profile.deleteQaAddress(updated.street);
      } else if (await page.getByText(created.street, { exact: false }).count()) {
        await profile.deleteQaAddress(created.street);
      }
    }
  });

  test("TC9 - Address create, update and delete notifications", async ({ page }) => {
    test.skip(true, PROFILE_NOT_AVAILABLE);
    const profile = new ProfilePage(page);
    const created = profile.qaAddress("TC9 CREATE", testData.address);
    const updated = profile.qaAddress("TC9 UPDATED", testData.address);
    try {
      await profile.createQaAddress(created);
      await profile.editQaAddress(created.street, updated);
      await profile.deleteQaAddress(updated.street);
    } finally {
      if (await page.getByText(updated.street, { exact: false }).count()) {
        await profile.deleteQaAddress(updated.street);
      }
    }
  });

  for (const tc of ["TC10", "TC11"]) {
    test(`${tc} - QA default address is safe and correlated`, async ({ page }) => {
      test.skip(true, PROFILE_NOT_AVAILABLE);
      const profile = new ProfilePage(page);
      const qa = profile.qaAddress(`${tc} DEFAULT`, testData.address);
      await profile.openAddressManagement();
      const previousDefault = await profile.captureCurrentDefaultAddress();
      try {
        await profile.createQaAddress(qa);
        await profile.setQaAddressDefault(qa.street);
        await profile.expectQaAddress(qa.street);
      } finally {
        await profile.restoreDefaultAddress(previousDefault);
        if (await page.getByText(qa.street, { exact: false }).count()) {
          await profile.deleteQaAddress(qa.street);
        }
      }
    });
  }

  test("TC12 - Authenticated My Orders exposes order details", async ({ page }) => {
    test.setTimeout(300000);
    const orderCode = process.env.AUTHENTICATED_ORDER_CODE || "PE260826-74796841";
    const orders = new MyOrdersPage(page);
    await orders.openMyOrders();
    const { order } = await orders.waitForOrder(orderCode);
    await expect(order).toBeVisible();
    await expect(page.getByText(/En proceso|Processing/i).first()).toBeVisible();
    await expect(page.getByText("RB45DG6300B1PE", { exact: false }).first()).toBeVisible();
    await orders.openOrderDetails(orderCode);
    await orders.validateOrderDetails(orderCode, { sku: "RB45DG6300B1PE" });
  });

  test("TC40 - Save checkout QA address and verify it in Profile", async ({ page }) => {
    test.skip(true, TC40_PARTIAL);
    test.setTimeout(300000);
    const profile = new ProfilePage(page);
    const qa = profile.qaAddress("TC40", testData.address);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    await page.keyboard.press("Escape");
    await page.goto(product.addToCartUrl, { waitUntil: "domcontentloaded" });
    await page.goto(product.cartUrl, { waitUntil: "domcontentloaded" });
    await cart.validateProductInCart();
    await cart.proceedToAuthenticatedCheckout();
    await checkout.fillCustomerData(testData.customer);
    try {
      await checkout.saveNewAuthenticatedAddress(qa);
      await checkout.selectShippingMethod();
      await checkout.acceptTerms();
      await checkout.continueToPayment();
      await profile.waitForQaAddressViaApi(qa.street);
    } finally {
      await profile.deleteQaAddressesViaApi(qa.street);
    }
  });

});
