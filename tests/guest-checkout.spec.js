import { test } from '@playwright/test';

import ProductPage from '../pages/ProductPage';
import GuestLoginPage from '../pages/GuestLoginPage';
import CartPage from '../pages/CartPage';
import CheckoutPage from '../pages/CheckoutPage';
import PaymentPage from '../pages/PaymentPage';
import OrderConfirmationPage from '../pages/OrderConfirmationPage';

import { testData } from '../utils/testData';

test.describe('Samsung Guest Checkout', () => {
  test('Should complete guest checkout flow as guest user', async ({ page }) => {
    const productPage = new ProductPage(page);
    const guestLoginPage = new GuestLoginPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const paymentPage = new PaymentPage(page);
    const orderConfirmationPage = new OrderConfirmationPage(page);

    await test.step('Open product/add-to-cart flow', async () => {
      await productPage.validateProductLoaded();
      await productPage.addToCart();
    });

    await test.step('Validate cart and proceed to checkout', async () => {
      await cartPage.validateProductInCart();
      await cartPage.proceedToCheckout();
    });

    await test.step('Checkout as guest user', async () => {
  await guestLoginPage.checkoutAsGuest(testData.customer.email);
});

    await test.step('Fill customer information', async () => {
      await checkoutPage.fillCustomerData(testData.customer);
    });

    await test.step('Fill delivery address', async () => {
      await checkoutPage.fillAddress(testData.address);
    });

    await test.step('Select shipping method', async () => {
      await checkoutPage.selectShippingMethod();
    });

    await test.step('Accept terms and continue to payment', async () => {
      await checkoutPage.acceptTerms();
      await checkoutPage.continueToPayment();
    });

    await test.step('Fill credit card payment data', async () => {
      await paymentPage.selectCreditCard();
      await paymentPage.fillCardData(testData.card);
    });

    await test.step('Place order', async () => {
      await paymentPage.placeOrder();
    });

    await test.step('Validate order confirmation', async () => {
      await orderConfirmationPage.validateOrderCreated();
    });
  });
});