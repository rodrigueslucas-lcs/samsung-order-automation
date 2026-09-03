import { expect } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import MxCheckoutPage from "../../../../../pages/MxCheckoutPage";

function configuredProduct(page, config) {
  return new ProductPage(page, {
    setupUrl: config.bootstrapUrl.toString(),
    sku: config.sku,
    pdpUrl: config.pdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
}

function configuredCart(page, config) {
  return new CartPage(page, {
    cartUrl: config.cartUrl.toString(),
    sku: config.sku,
    productNamePattern: null,
    orderSummaryPattern: /Resumen de tu pedido/i,
    totalPattern: /Total con IVA/i,
    checkoutButtonPattern: /Finalizar Compra/i,
    currencyPattern: /\$\s*[\d,.]+/,
  });
}

export async function reachMxGuestPayment(page, config, email) {
  await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/You can access pages now/i)).toBeVisible({ timeout: 60000 });
  const product = configuredProduct(page, config);
  await product.addConfiguredPdpToCart();
  const cart = configuredCart(page, config);
  await cart.proceedToCheckout();
  const checkout = new MxCheckoutPage(page);
  await checkout.startGuest(email);
  await checkout.fillContact({ firstName: "MX", lastName: "Automation", phone: "5512345678" });
  await checkout.validateCheckoutSummary(config.sku);
  const address = await checkout.fillDelivery({
    postalCode: "01000",
    street: "Avenida Revolucion",
    exteriorNumber: "1000",
  });
  await checkout.selectDeliveryAndContinue();
  await checkout.validatePaymentPage({ postalCode: "01000" });
  return { checkout, address };
}

export async function reachMxRegisteredPayment(page, config) {
  const cart = configuredCart(page, config);
  await cart.clearMxCartAndConfirmEmpty();
  await configuredProduct(page, config).addConfiguredPdpToCart({
    waitForCartMutation: true,
  });
  await cart.validateControlledSingleSku(config.sku);
  await cart.proceedToAuthenticatedCheckout();
  const checkout = new MxCheckoutPage(page);
  await checkout.fillRegisteredContact({
    firstName: "MX",
    lastName: "Automation",
    phone: "5512345678",
  });
  const address = await checkout.fillDelivery(
    { postalCode: "01000", street: "Avenida Revolucion", exteriorNumber: "1000" },
    { registered: true }
  );
  await checkout.selectDeliveryAndContinue();
  await checkout.validatePaymentPage({ postalCode: "01000" });
  return { checkout, address };
}
