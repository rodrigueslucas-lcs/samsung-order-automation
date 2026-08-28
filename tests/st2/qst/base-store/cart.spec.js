import { test, expect } from "@playwright/test";
import ProductPage from "../../../../pages/ProductPage";
import CartPage from "../../../../pages/CartPage";
import { annotateQstExecution } from "../../../../utils/qstExecutionSummary";

async function openCartWithProduct(page) {
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  await product.validateProductLoaded();
  await product.addToCart();
  return cart;
}

test("QST-BS-06 @qst @qst-normal @qst-modified @base-store - Add to Cart", async ({ page }, testInfo) => {
  test.setTimeout(150000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const cart = await openCartWithProduct(page);
  await cart.validateProductInCart();
});

test("QST-BS-07 @qst @qst-normal @base-store - Cart page display", async ({ page }, testInfo) => {
  test.setTimeout(150000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const cart = await openCartWithProduct(page);
  await cart.validateCartPage();
  await cart.validateProductInCart();
});

test("QST-BS-08 @qst @qst-normal @base-store - Cart order summary", async ({ page }, testInfo) => {
  test.setTimeout(150000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const cart = await openCartWithProduct(page);
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
});

test("QST-BS-11 @qst @qst-normal @qst-modified @base-store - Navigate to Checkout", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const cart = await openCartWithProduct(page);
  await cart.proceedToCheckout();
  await page.getByPlaceholder(/ingresa tu correo/i).waitFor({ state: "visible", timeout: 30000 });
});

test("QST-BS-09 @qst @qst-normal @qst-modified @base-store - Add Trade-In service", async ({ page }, testInfo) => {
  test.setTimeout(240000);
  annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  await product.validateProductLoaded();
  await product.addToCartForAdditionalServices();
  await cart.openTradeInJourney();
  await cart.completeTradeInJourney();
  await cart.validateTradeInAdded();
  await cart.validateTradeInSummaryAmount();
});
