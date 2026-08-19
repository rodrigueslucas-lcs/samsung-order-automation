# ST2 Peru - Detailed Smoke Automation Coverage

**Environment:** ST2 Peru  
**Framework:** Playwright  
**Last Updated:** 2026-08-19

## Summary

| Scope | Total | Automated | Partial | Blocked | Pending |
|---|---:|---:|---:|---:|---:|
| Base Store | 83 | 21 | 1 | 1 | 59 |
| EPP | ~60 | 0 | 0 | 0 | ~60 |

### Status Legend

- ✅ Automated
- ⚠️ Partial
- 🚧 Blocked
- ⬜ Pending
- ➖ Not Applicable

## Base Store

| No. | Functionality | Test Scenario | Automation Status | File | Notes |
|---:|---|---|---|---|---|
| 1 | Login Page | Customer able to login as register User from Home Page (My Account) | ⬜ Pending | — | — |
| 2 | Login Page | Customer able to login from Home Page(My Account) via shop menu | ⬜ Pending | — | — |
| 3 | Login Page | Customer able to login from Checkout Page | ⬜ Pending | — | — |
| 4 | Login Page | Customer able to login from Order Confirmation Email (If Applicable) | ⬜ Pending | — | — |
| 5 | Login Page | Guest Customer, able to place order until Cart Page. Then Customer able to login from Checkout Page. | ⬜ Pending | — | — |
| 6 | MyAccount Page | Customer able hover on the Profile Icon and verify the Login/Sign-up & MyOrder Page Link. | ⬜ Pending | — | — |
| 7 | MyAccount Page | Customer able to see all the saved shipping and billing addresses in the My Profile Page. | ⬜ Pending | — | — |
| 8 | MyAccount Page | Customer able to add, edit &delete address for shipping & billing address. | ⬜ Pending | — | — |
| 9 | MyAccount Page | Customer able to show notification when adding, updating and deleting address for shipping and billing address. | ⬜ Pending | — | — |
| 10 | MyAccount Page | Customer able to set default address for shipping & billing. | ⬜ Pending | — | — |
| 11 | MyAccount Page | Customer able to verify the populated address is same on what is default address for shipping & billing in the Profile Setting. | ⬜ Pending | — | — |
| 12 | MyAccount Page | Customer able to see Order List/ Order Details in My Orders Page. | ⬜ Pending | — | — |
| 13 | MyAccount Page | Customer able to verify Tracking Order Page (Includes Guest) | ⬜ Pending | — | — |
| 14 | Home Page | Customer able to see Homepage Attributes (Header, Hero banner, Top seller carousel, Footer) | ⬜ Pending | — | — |
| 15 | Cart Page | Customer able to see the Cart Page | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 16 | Cart Page | Customer able to verify cart page (Products added displays correctly) | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 17 | Cart Page | Customer able to increase and decrease the quantity (or remove products) | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 18 | Cart Page | Customer able to see order summary is displayed correctly on right side (without taxes) | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 19 | Cart Page | Verify Added services / Recommended products - (If there's available data) | ⬜ Pending | — | — |
| 20 | Cart Page | Customer able to see Checkout Button | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 21 | Externale Services | Customer able to see external services such Trade-in or Samsung Care Plus. | ⬜ Pending | — | — |
| 22 | Externale Services | Customer able to see the Footer for Cart Page | ⬜ Pending | — | — |
| 23 | Externale Services | Customer able to click the trade-in button. | ⬜ Pending | — | — |
| 24 | Externale Services | Customer able to navigate on Pop- up customer journey in adding Trade-In. | ⬜ Pending | — | — |
| 25 | Externale Services | Customer able to see the trade-in amount on the last pop-up in the customer Journey in adding Trade-In. | ⬜ Pending | — | — |
| 26 | Externale Services | Customer able to successfully added Trade-in In the cart page. | ⬜ Pending | — | — |
| 27 | Externale Services | Customer able to see the Trade-in Amount in the summary. | ⬜ Pending | — | — |
| 28 | Externale Services | Customer able to click the Samsung Care Plus Button | ⬜ Pending | — | — |
| 29 | Externale Services | Customer able to navigate on Pop-up Customer Journey in adding Samsung Care Plus. | ⬜ Pending | — | — |
| 30 | Externale Services | Customer able to successfully added Samsung Care Plus In the cart page. | ⬜ Pending | — | — |
| 31 | Externale Services | Customer able to see the Samsung Care Plus Amount in the summary. | ⬜ Pending | — | — |
| 32 | Externale Services | Total price should change after Trade-In/ SC+ is applied in the cart. Note: Please Keep the Screenshot for future reference | ⬜ Pending | — | — |
| 33 | Cart Page | Customer able to navigate to Checkout Page, when click the Checkout Button. | ✅ Automated | `tests/st2/base-store/cart/cart.spec.js` | Passed |
| 34 | Checkout Page | Customer able to see Checkout Login Page | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 35 | Checkout Page | Customer able to see the Checkout Address Page | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 36 | Checkout Page | Customer able to see the Checkout Login button in the Checkout Address Page. | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 37 | Checkout Page | Customer able to verify checkout page (Products added displays correctly in Summary details) | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed |
| 38 | Checkout Page | Customer able to verify checkout page for Tax is applied correctly and price break down is displayed properly.(NET price) | ✅ Automated | `tests/st2/base-store/checkout/checkout.spec.js` | Passed - PE UI exposes Subtotal/Total |
| 39 | Checkout Page | Customer able to used save address in checking out. | ⬜ Pending | — | — |
| 40 | Checkout Page | Customer able to saved address in checkout page and Verify it on the profile-setting. | ⬜ Pending | — | — |
| 41 | Checkout Page | Customer Able to enter different addresses for shipping and billing: | ⬜ Pending | — | — |
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
| 61 | Payment Page/Checkout Page | Customer able to navigate back to cart from Payment page, Checkout page using the Edit button | ⚠️ Partial | `tests/st2/base-store/payment/payment-navigation.spec.js` | Payment Page → Cart validated; Checkout Page → Cart still pending |
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
| 77 | Payment Mode | Customer able to place order using Credit Card [pe-mercadoCC] (Master, Visa, AMX) | ⬜ Pending | — | — |
| 78 | Payment Mode | Customer able to place order using SafetyPay - Banca por Internet [pe-Bancapor] | ⬜ Pending | — | — |
| 79 | Payment Mode | Customer able to place order using Cash Payment [pe-pagoEfectivo]. Note: can only accept payment with maximum amount of S/ 10,000 | ⬜ Pending | — | — |
| 80 | Payment Mode | Customer able to place order using Cuotéalo [pe-Cuotealo]. The maximum amount allowed is S/ 7,000.00 | ⬜ Pending | — | — |
| 81 | Payment Mode | Customer able to place order using Yape [pe-yape] | ⬜ Pending | — | — |
| 82 | Payment Mode | Customer able to place order using Acuotaz | ⬜ Pending | — | — |
| 83 | Mobile | Customer able to place order using own mobile | ⬜ Pending | — | — |

## EPP

> EPP Detailed Smoke coverage will use the same status model. The official EPP scenarios will be added here preserving their Confluence names and order.

