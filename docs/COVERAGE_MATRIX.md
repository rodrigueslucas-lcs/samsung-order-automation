# ST2 Peru - Detailed Smoke Automation Coverage

**Environment:** ST2 Peru  
**Framework:** Playwright  
**Last Updated:** 2026-08-24

## Summary

| Scope | Total | Automated | Partial | Blocked | Not Applicable | Pending |
|---|---:|---:|---:|---:|---:|---:|
| Base Store | 83 | 35 | 11 | 5 | 2 | 30 |
| EPP | ~60 | 0 | 0 | 0 | 0 | ~60 |

### Status Legend

- ✅ Automated
- ⚠️ Partial
- 🚧 Blocked
- ⬜ Pending
- ➖ Not Applicable

## Base Store

| No. | Functionality | Test Scenario | Automation Status | File | Notes |
|---:|---|---|---|---|---|
| 1 | Login Page | Customer able to login as register User from Home Page (My Account) | ⚠️ Partial | `tests/st2/base-store/home/login.spec.js` | Registered authenticated session validated from Home; full Google/FedCM/MFA login is intentionally not automated |
| 2 | Login Page | Customer able to login from Home Page(My Account) via shop menu | ⚠️ Partial | `tests/st2/base-store/home/login.spec.js` | Authenticated Profile entry through the Home header validated; full identity-provider login is intentionally not automated |
| 3 | Login Page | Customer able to login from Checkout Page | ⚠️ Partial | `tests/st2/base-store/checkout/checkout.spec.js` | Passed pre-auth: Product→Cart→Checkout exposed `Samsung Checkout Express` and navigated to `account.samsung.com/iam/*`; credentials/FedCM/MFA were intentionally not automated |
| 4 | Login Page | Customer able to login from Order Confirmation Email (If Applicable) | ⬜ Pending | — | — |
| 5 | Login Page | Guest Customer, able to place order until Cart Page. Then Customer able to login from Checkout Page. | ⚠️ Partial | `tests/st2/base-store/checkout/checkout.spec.js` | Product→Cart checkpoint and registered-login entry from Checkout passed; external Samsung Account authentication was not automated |
| 6 | MyAccount Page | Customer able hover on the Profile Icon and verify the Login/Sign-up & MyOrder Page Link. | 🚧 Blocked | — | Login/Register render consistently, but the dynamic `Mis pedidos` item was intermittent: one pass followed by two repeat failures in the same ST2 environment |
| 7 | MyAccount Page | Customer able to see all the saved shipping and billing addresses in the My Profile Page. | 🚧 Blocked | — | Authenticated user header and Logout are available, but the current ST2 menu exposes no working My Profile/address entry point; the visible user menu item timed out on a normal click |
| 8 | MyAccount Page | Customer able to add, edit &delete address for shipping & billing address. | 🚧 Blocked | — | The current ST2 UI exposes no working My Profile/address entry point, and no disposable QA address could be identified safely; pre-existing account data was not modified |
| 9 | MyAccount Page | Customer able to show notification when adding, updating and deleting address for shipping and billing address. | ⬜ Pending | — | — |
| 10 | MyAccount Page | Customer able to set default address for shipping & billing. | ⬜ Pending | — | — |
| 11 | MyAccount Page | Customer able to verify the populated address is same on what is default address for shipping & billing in the Profile Setting. | ⬜ Pending | — | — |
| 12 | MyAccount Page | Customer able to see Order List/ Order Details in My Orders Page. | 🚧 Blocked | — | Reusable authenticated state is proven, but `Mis pedidos` is currently absent from both the reusable and live authenticated menus despite `/users/current` and `checkAccess` returning HTTP 200; existing order data is also not yet confirmed |
| 13 | MyAccount Page | Customer able to verify Tracking Order Page (Includes Guest) | ⚠️ Partial | `tests/st2/base-store/home/tracking.spec.js` | Guest `Pedidos` entry from the Home footer successfully opened and the Samsung Peru orders/tracking destination was validated; disposable guest order number/email is still required for full tracking validation |
| 14 | Home Page | Customer able to see Homepage Attributes (Header, Hero banner, Top seller carousel, Footer) | ⚠️ Partial | `tests/st2/base-store/home/home.spec.js` | Header and Footer available; Hero banner and Top seller carousel are not rendered in current ST2 Home |
| 15 | Cart Page | Customer able to see the Cart Page | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 16 | Cart Page | Customer able to verify cart page (Products added displays correctly) | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 17 | Cart Page | Customer able to increase and decrease the quantity (or remove products) | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 18 | Cart Page | Customer able to see order summary is displayed correctly on right side (without taxes) | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 19 | Cart Page | Verify Added services / Recommended products - (If there's available data) | ⬜ Pending | — | Current SKU exposes the Additional Services offer, but no recommended product is rendered and the service cannot currently be added because its endpoint returns HTTP 400 |
| 20 | Cart Page | Customer able to see Checkout Button | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 21 | Externale Services | Customer able to see external services such Trade-in or Samsung Care Plus. | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed with Samsung Care+ / Services available for current SKU |
| 22 | Externale Services | Customer able to see the Footer for Cart Page | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 23 | Externale Services | Customer able to click the trade-in button. | ⬜ Pending | — | — |
| 24 | Externale Services | Customer able to navigate on Pop- up customer journey in adding Trade-In. | ⬜ Pending | — | — |
| 25 | Externale Services | Customer able to see the trade-in amount on the last pop-up in the customer Journey in adding Trade-In. | ⬜ Pending | — | — |
| 26 | Externale Services | Customer able to successfully added Trade-in In the cart page. | ⬜ Pending | — | — |
| 27 | Externale Services | Customer able to see the Trade-in Amount in the summary. | ⬜ Pending | — | — |
| 28 | Externale Services | Customer able to click the Samsung Care Plus Button | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Automation implemented and validated previously; current modal opens but remains at `Cargando página...` after the External Services endpoint returns HTTP 400 |
| 29 | Externale Services | Customer able to navigate on Pop-up Customer Journey in adding Samsung Care Plus. | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Automation implemented and validated previously; current modal journey cannot render beyond `Cargando página...` after the External Services endpoint returns HTTP 400 |
| 30 | Externale Services | Customer able to successfully added Samsung Care Plus In the cart page. | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed with functional Additional Services setup using RB45DG6300B1PE + SM-F741BLBKPEO; Samsung Care+ was added successfully to Cart |
| 31 | Externale Services | Customer able to see the Samsung Care Plus Amount in the summary. | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed - added Samsung Care+ amount S/ 389.00 was validated in the Order Summary |
| 32 | Externale Services | Total price should change after Trade-In/ SC+ is applied in the cart. Note: Please Keep the Screenshot for future reference | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed - Cart total increased by S/ 389.00 after Samsung Care+ was applied; screenshots captured as evidence |
| 33 | Cart Page | Customer able to navigate to Checkout Page, when click the Checkout Button. | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 34 | Checkout Page | Customer able to see Checkout Login Page | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 35 | Checkout Page | Customer able to see the Checkout Address Page | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 36 | Checkout Page | Customer able to see the Checkout Login button in the Checkout Address Page. | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 37 | Checkout Page | Customer able to verify checkout page (Products added displays correctly in Summary details) | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 38 | Checkout Page | Customer able to verify checkout page for Tax is applied correctly and price break down is displayed properly.(NET price) | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed - PE UI exposes Subtotal/Total |
| 39 | Checkout Page | Customer able to used save address in checking out. | ✅ Automated | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | Passed - selected and validated `Dirección guardada`, reused guest shipping/terms/continue, and reached Payment without modifying the saved address or placing an order |
| 40 | Checkout Page | Customer able to saved address in checkout page and Verify it on the profile-setting. | ⬜ Pending | — | Fresh auth on 2026-08-24 exposed only the user menuitem and Logout; the normal user-menu click timed out without navigation, so no QA address was persisted without a safe Profile readback/cleanup path |
| 41 | Checkout Page | Customer Able to enter different addresses for shipping and billing: | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed - separate Delivery and Billing values validated without advancing to Payment |
| 42 | Checkout Page | Customer able to input any Phone Number | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 43 | Checkout Page | Customer able to input any Address: | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 44 | Checkout Page | Customer able to input any Address line 2 (Optional): | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 45 | Checkout Page | Customer able to input any City: | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed - Distrito validated as City for Peru |
| 46 | Checkout Page | Customer able to input any Province: | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 47 | Checkout Page | Customer able to input any Postal Code: | ➖ Not Applicable | — | Postal Code field is not available in ST2 Peru Delivery or Billing UI |
| 48 | Checkout Page | Cannot save the address as a guest user | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 49 | Checkout Page | Customer able see available delivery mode | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 50 | Checkout Page | Customer able to select delivery mode | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 51 | Checkout Page | Customer able to select Date & Time to the delivery calendar (If applicable or there is available data) | ➖ Not Applicable | — | Current ST2 data returns no delivery dates or time slots for Agenda tu envío |
| 52 | Checkout Page | Customer able to see the Footer for Cart Page | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 53 | Checkout Page | Customer able to navigate to Payment Page, when click the BuyNow Button. | ✅ Automated | `tests/st2/base-store/payment/payment.spec.js` | Passed |
| 54 | Payment Page | Customer able to see the Payment Page | ✅ Automated | `tests/st2/base-store/payment/payment.spec.js` | Passed |
| 55 | Payment Page | Customer able to see the price break down. | ✅ Automated | `tests/st2/base-store/payment/payment.spec.js` | Passed |
| 56 | Payment Page | Customer able to see the address for Shipping and Billing | ✅ Automated | `tests/st2/base-store/payment/payment.spec.js` | Passed |
| 57 | Payment Page | Customer able to see all available Payment mode | ✅ Automated | `tests/st2/base-store/payment/payment.spec.js` | Passed |
| 58 | Payment Page | Customer able to complete order using one payment mode. | 🚧 Blocked | `tests/st2/base-store/payment/payment.spec.js` | Automation reaches submit successfully; blocked by ST2 backend/siteId transaction issue |
| 59 | Customer Order Journey | Customer able to place one IM order with Trade-in and SC+. (If there is available data) | ⬜ Pending | — | — |
| 60 | Customer Order Journey | Customer able to place one CE order. (If there is available data) | ⬜ Pending | — | — |
| 61 | Payment Page/Checkout Page | Customer able to navigate back to cart from Payment page, Checkout page using the Edit button | ✅ Automated | `tests/st2/base-store/payment/payment-navigation.spec.js`, `tests/st2/base-store/checkout/checkout.spec.js` | Passed - Payment → Cart and Checkout → Cart validated |
| 62 | Confirmation Page | Customer able to see the confirmation after placing order. | ⬜ Pending | — | — |
| 63 | Order Email | Customer able to received Order confirmation/ acknowledgment email | ⬜ Pending | — | — |
| 64 | BackOffice | User able to login successfully in the BackOffice | ⬜ Pending | — | — |
| 65 | BackOffice | User able to see order page(Admin view) | ⬜ Pending | — | — |
| 66 | BackOffice | User able to see orderpage(CS Agent View) | ⬜ Pending | — | — |
| 67 | BackOffice | User able to cancelled order via CS Agent View | ⬜ Pending | — | — |
| 68 | BackOffice | User able to see the status of order is cancelled | ⬜ Pending | — | — |
| 69 | BackOffice | User able to view cronjobs page | ⬜ Pending | — | — |
| 70 | BackOffice | Verify we can not save changes into Anonymous's user addresses | ⬜ Pending | — | — |
| 71 | Order Fullfillment | User able to search order via BackOffice order Page. | ⬜ Pending | — | — |
| 72 | Order Fullfillment | User able to validate the initial status is on "Waiting for Send Financial" | ⬜ Pending | — | — |
| 73 | Order Fullfillment | User able to run cronjob: tokoFinancialInitialUpdateJob | ⬜ Pending | — | — |
| 74 | Order Fullfillment | User able to validate the updated order status is on "Order Split" | ⬜ Pending | — | — |
| 75 | Order Fullfillment | User able to run cronjob: tokoTransferConsignmentToWarehouseJob | ⬜ Pending | — | — |
| 76 | Order Fullfillment | User able to validate the updated order status is on "Shipping Requested" | ⬜ Pending | — | — |
| 77 | Payment Mode | Customer able to place order using Credit Card [pe-mercadoCC] (Master, Visa, AMX) | ⚠️ Partial | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | Pre-submit passed: existing Mercado Pago sandbox data, installments and required iframe fields were populated and `Realizar pedido` became enabled; the button was not clicked |
| 78 | Payment Mode | Customer able to place order using SafetyPay - Banca por Internet [pe-Bancapor] | ⚠️ Partial | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | Pre-submit passed: authenticated saved-address checkout reached Payment and `Banca por Internet` became selected (`aria-expanded=true`); Place Order was intentionally not executed |
| 79 | Payment Mode | Customer able to place order using Cash Payment [pe-pagoEfectivo]. Note: can only accept payment with maximum amount of S/ 10,000 | ⚠️ Partial | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | Pre-submit passed: authenticated saved-address checkout reached Payment and `Pago Efectivo` became selected (`aria-expanded=true`); Place Order was intentionally not executed |
| 80 | Payment Mode | Customer able to place order using Cuotéalo [pe-Cuotealo]. The maximum amount allowed is S/ 7,000.00 | ⚠️ Partial | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | Pre-submit passed: Cuotéalo was available, expanded with `aria-expanded=true`, and its controlled payment panel rendered non-empty content; Place Order was not executed |
| 81 | Payment Mode | Customer able to place order using Yape [pe-yape] | ⬜ Pending | — | Current Payment availability could not be revalidated because the authenticated preflight expired before Checkout; no fallback or Place Order was attempted |
| 82 | Payment Mode | Customer able to place order using Acuotaz | ⬜ Pending | — | Current Payment availability could not be revalidated because the authenticated preflight expired before Checkout; no fallback or Place Order was attempted |
| 83 | Mobile | Customer able to place order using own mobile | ⚠️ Partial | `tests/st2/base-store/mobile/mobile-order.spec.js` | Mobile guest checkout passed twice at 390x844 through Payment with credit card data ready pre-submit; Place Order was intentionally not executed due to the known post-submit defect |

## Supplementary ST2 Coverage

> These checks increase regression coverage but do not change the official 83-scenario Detailed Smoke count above.

| Area | Scenario | File | Status |
|---|---|---|---|
| Guest Login | Invalid guest email shows validation and keeps guest checkout disabled | `tests/st2/base-store/guest-login/guest-login.spec.js` | ✅ Passed |
| Cart | Quantity cannot decrease below 1 | `tests/st2/base-store/cart/cart-negative.spec.js` | ✅ Passed |
| Mobile | Responsive Header/Footer smoke at 390x844 | `tests/st2/base-store/mobile/mobile.spec.js` | ✅ Passed |
| PDP | Product title, SKU, gallery, specifications and recommendations smoke | `tests/st2/base-store/pdp/pdp.spec.js` | ✅ Passed |
| Search | Autocomplete suggestions and related-product behavior | `tests/st2/base-store/search/search.spec.js` | ✅ Passed |
| Cart | Available payment methods are displayed | `tests/st2/base-store/cart/cart.spec.js` | ✅ Passed |
| Cart | Invalid coupon is processed without changing cart total | `tests/st2/base-store/cart/cart-negative.spec.js` | ✅ Passed |

## EPP

> EPP Detailed Smoke coverage will use the same status model. The official EPP scenarios will be added here preserving their Confluence names and order.
