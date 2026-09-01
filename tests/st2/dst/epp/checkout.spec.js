import { test, expect } from "./epp.fixture";
import { reachEppContact, reachEppDelivery, reachEppPayment } from "./eppFlows";

test("TC20 TC22 TC23 @dst @epp @base-store - EPP Checkout address and summary", async ({ page, eppSmokeConfig }) => {
  test.setTimeout(300000);
  const { checkout } = await reachEppDelivery(page, eppSmokeConfig);
  await checkout.validateAuthenticatedDeliveryForm();
  await checkout.validateCheckoutProductSummary({ sku: eppSmokeConfig.smokeSku });
  await checkout.validateCheckoutPriceBreakdown();
});

test("TC24 @dst @epp @base-store - EPP Checkout phone field", async ({ page, eppSmokeConfig }) => {
  const { checkout, customer } = await reachEppContact(page, eppSmokeConfig);
  await checkout.validatePhoneNumberInput(customer.phone);
});

test("TC25 TC26 TC27 TC28 @dst @epp @base-store - EPP Checkout address fields", async ({ page, eppSmokeConfig }) => {
  const { checkout, address } = await reachEppDelivery(page, eppSmokeConfig);
  await checkout.validateAddressInput(address.street);
  await checkout.validateAddressLine2Input("QA AUTOMATION EPP");
  await checkout.validateCityInput(address);
  await checkout.validateProvinceInput(address);
});

test("TC33 TC36 @dst @epp @base-store - EPP delivery modes and Checkout footer", async ({ page, eppSmokeConfig }) => {
  test.setTimeout(300000);
  const { checkout, address } = await reachEppDelivery(page, eppSmokeConfig);
  await checkout.fillAddress(address);
  await checkout.validateAddressValues(address);
  await checkout.validateAvailableDeliveryModes();
  await checkout.validateCheckoutFooter();
});

test("TC37 @dst @epp @base-store - EPP navigates to Payment without submit", async ({ page, eppSmokeConfig }) => {
  test.setTimeout(360000);
  await reachEppPayment(page, eppSmokeConfig);
  expect(page.url()).toMatch(/CHECKOUT_STEP_PAYMENT/);
});

test("TC34 @dst @epp @base-store - EPP delivery mode can be selected", async ({ page, eppSmokeConfig }) => {
  const { checkout, address } = await reachEppDelivery(page, eppSmokeConfig);
  await checkout.fillAddress(address);
  await checkout.validateDeliveryModeSelection();
});
