import { test, expect } from "@playwright/test";

import ProductPage from "../../../pages/ProductPage";
import CartPage from "../../../pages/CartPage";

test.describe("ST2 - Cart Page", () => {

  test("TC17 - Customer able to increase and decrease the quantity (or remove products)", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();

    const quantity = page.getByRole("textbox", { name: "Quantity" });
    const plusButton = page.getByRole("button", { name: "+" });
    const minusButton = page.getByRole("button", { name: "-" });

    await expect(quantity).toHaveValue("1");

    await plusButton.click();

    await expect(quantity).toHaveValue("2", {
      timeout: 30000,
    });

    await minusButton.click();

    await expect(quantity).toHaveValue("1", {
      timeout: 30000,
    });
  });


  test("TC18 - Customer able to see order summary is displayed correctly on right side (without taxes)", async ({ page }) => {
    test.setTimeout(120000);

    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);

    await productPage.validateProductLoaded();
    await productPage.addToCart();

    await cartPage.validateProductInCart();

    const summary = await cartPage.validateOrderSummary();

    expect(summary.subtotal).toBeTruthy();
    expect(summary.total).toBeTruthy();
    expect(summary.total).toBe(summary.subtotal);
  });

});
