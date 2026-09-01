# DST EPP Peru Coverage Matrix

This matrix is independent from the 83-case DST Base Store matrix and from both QST matrices. The supplied historical Peru result is recorded as context only:

> **Historic manual Pass is not current automation evidence.** `Automated` requires a successful execution against a verified non-Production EPP environment.

## Summary

| Scope | Total | Automated | Reusable - needs EPP wrapper | Partial | Blocked | Not implemented | N/A |
|---|---:|---:|---:|---:|---:|---:|---:|
| DST EPP | 59 | 0 | 41 | 0 | 18 | 0 | 0 |

All 59 scenarios have at least one Base Store Page Object, helper or flow that can be assessed for reuse. Forty-one are structurally ready for a thin EPP wrapper once the environment exists. The other eighteen require EPP-specific entitlement, safe mutable data, a causal order, payment, BackOffice mapping or fulfillment mass before a trustworthy wrapper can be completed.

| ID | Functionality | User Type | Scenario | Historic PE status | Reusable automation | Page Object/helper | Automation status | Dependency/blocker | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TC01 | Login | Registered | Login through EPP SSO | Pass | Base TC1-TC3 auth pattern | `authState`, `HomePage` | Blocked | EPP URL, SSO and entitlement unknown | Do not automate MFA/FedCM/CAPTCHA |
| TC02 | Login | Registered | Login from Order Confirmation Email | Pass | Base TC4 email CTA flow | `MailinatorPage`, `MyAccountPage` | Blocked | Requires EPP email template, CTA and eligible account | Never redirect into Production |
| TC03 | My Account | Registered | Profile menu and account navigation | Pass | Base TC6 | `MyAccountPage`, `ProfilePage` | Reusable - needs EPP wrapper | Verified EPP DOM and route | Read-only first |
| TC04 | Addresses | Registered | View saved shipping and billing addresses | Pass | Base TC7 | `ProfilePage` | Blocked | EPP address UI/account mass unknown | Never expose personal address data |
| TC05 | Addresses | Registered | Add, edit and delete shipping/billing address | Pass | Base TC8 | `ProfilePage`, `CheckoutPage` | Blocked | QA-owned address flow and cleanup must be proven | Marker must be `QA AUTOMATION` |
| TC06 | Addresses | Registered | Address mutation notifications | Pass | Base TC9 | `ProfilePage` | Blocked | Depends on safe TC05 UI mutation | Cleanup in `finally` |
| TC07 | Addresses | Registered | Default address and checkout correlation | Pass | Base TC10-TC11/TC40 | `ProfilePage`, `CheckoutPage` | Blocked | Existing personal defaults cannot be changed | Skip unless ownership/restoration is guaranteed |
| TC08 | My Orders | Registered | Order list and order details | Pass | Base TC12 | `MyOrdersPage` | Reusable - needs EPP wrapper | EPP account with prior QA order | Read-only |
| TC09 | Tracking | Guest/Registered | Tracking Order Page including guest OTP | Pass | Base TC13 | `GuestOrderTrackingPage`, `MailinatorPage` | Reusable - needs EPP wrapper | EPP order/email correlation | One OTP request; no blind resend |
| TC10 | Homepage | Registered | Header, hero, top seller and footer | Pass | Base TC14 | `HomePage` | Reusable - needs EPP wrapper | EPP URL/DOM | Assertions must reflect EPP content |
| TC11 | Cart | Registered | Cart page is displayed | Pass | Base TC15 | `CartPage` | Reusable - needs EPP wrapper | EPP SKU/cart route | No Base SKU assumption |
| TC12 | Cart | Registered | Added products display correctly | Pass | Base TC16 | `ProductPage`, `CartPage` | Reusable - needs EPP wrapper | EPP smoke SKU | Structural assertions, no fixed price |
| TC13 | Cart | Registered | Increase/decrease quantity or remove | Pass | Base TC17 | `CartPage` | Reusable - needs EPP wrapper | EPP cart DOM | Cart-only mutation |
| TC14 | Cart | Registered | Order summary without taxes | Pass | Base TC18 | `CartPage` | Reusable - needs EPP wrapper | EPP pricing model | Do not hardcode discount |
| TC15 | Cart | Registered | Added services/recommended products | Pass | Base TC19 | `CartPage` | Reusable - needs EPP wrapper | Eligible EPP product | Conditional data must be explicit |
| TC16 | Cart | Registered | Checkout CTA is available | Pass | Base TC20 | `CartPage` | Reusable - needs EPP wrapper | EPP cart route | Read-only until CTA click case |
| TC17 | External Services | Registered | Trade-In/Samsung Care+ availability | Pass | Base TC21 | `CartPage`, `ProductPage` | Reusable - needs EPP wrapper | EPP service eligibility | Base Store availability is not evidence |
| TC18 | Cart | Registered | Cart footer is displayed | Pass | Base TC22 | `CartPage` | Reusable - needs EPP wrapper | EPP DOM | Read-only |
| TC19 | Checkout | Registered | Navigate from Cart to Checkout | Pass | Base TC33 | `CartPage` | Reusable - needs EPP wrapper | EPP auth/checkout route | Stop before mutation if auth is invalid |
| TC20 | Checkout | Registered | Checkout contact/address page | Pass | Base TC35/TC39 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP account/address state | Preserve multi-delivery-group handling |
| TC21 | Checkout | Registered | Product summary is correct | Pass | Base TC37 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP cart product | Structural assertions |
| TC22 | Checkout | Registered | Tax/net price breakdown | Pass | Base TC38 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP pricing/tax behavior | No hardcoded price |
| TC23 | Checkout | Registered | Use a saved address | Pass | Base TC39 | `CheckoutPage` | Reusable - needs EPP wrapper | QA-owned saved address or safe read-only selection | Do not edit existing data |
| TC24 | Checkout Address | Registered | Enter phone number | Pass | Base TC42 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP form DOM | Synthetic QA value |
| TC25 | Checkout Address | Registered | Enter address line 1 | Pass | Base TC43 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP form DOM | `QA AUTOMATION` ownership |
| TC26 | Checkout Address | Registered | Enter optional address line 2 | Pass | Base TC44 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP form DOM | Synthetic QA value |
| TC27 | Checkout Address | Registered | Enter city/district | Pass | Base TC45 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP locality data | Peru semantics must be verified |
| TC28 | Checkout Address | Registered | Enter province | Pass | Base TC46 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP locality data | Select real staging option |
| TC29 | Checkout Address | Registered | Enter postal code when applicable | Pass | Base TC47 | `CheckoutPage` | Reusable - needs EPP wrapper | Field applicability unknown | May become N/A after EPP execution |
| TC30 | Checkout Address | Registered | Save QA address safely | Pass | Base TC40 | `ProfilePage`, `CheckoutPage` | Reusable - needs EPP wrapper | Ownership/readback/cleanup | Never persist personal data in evidence |
| TC31 | Checkout Address | Registered | Separate shipping and billing addresses | Pass | Base TC41 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP billing behavior | Synthetic values only |
| TC32 | Checkout Address | Registered | Address validation behavior | Pass | Base TC42-TC48 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP validation DOM | Avoid destructive save |
| TC33 | Delivery | Registered | Available delivery modes | Pass | Base TC49 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP SKU/address | Read-only discovery first |
| TC34 | Delivery | Registered | Select delivery mode | Pass | Base TC50 | `CheckoutPage` | Reusable - needs EPP wrapper | Eligible EPP delivery group | Handle all groups |
| TC35 | Delivery | Registered | Select delivery date/time if applicable | Pass | Base TC51 | `CheckoutPage` | Reusable - needs EPP wrapper | Slots/mass unknown | May become N/A after execution |
| TC36 | Checkout | Registered | Checkout footer | Pass | Base TC52 | `CheckoutPage` | Reusable - needs EPP wrapper | EPP DOM | Read-only |
| TC37 | Checkout | Registered | Navigate back to Cart | Pass | Base TC61 | `CheckoutPage`, `PaymentPage` | Reusable - needs EPP wrapper | EPP cart/checkout routes | No submit |
| TC38 | Payment | Registered | Navigate to Payment | Pass | Base TC53 | `CheckoutPage`, `PaymentPage` | Reusable - needs EPP wrapper | EPP auth/address/delivery | Pre-submit only |
| TC39 | Payment | Registered | Payment page is displayed | Pass | Base TC54 | `PaymentPage` | Reusable - needs EPP wrapper | EPP payment DOM | Pre-submit only |
| TC40 | Payment | Registered | Price breakdown | Pass | Base TC55 | `PaymentPage` | Reusable - needs EPP wrapper | EPP pricing | No fixed amount |
| TC41 | Payment | Registered | Shipping and billing addresses | Pass | Base TC56 | `PaymentPage` | Reusable - needs EPP wrapper | EPP checkout data | Do not log PII |
| TC42 | Payment | Registered | Available payment modes | Pass | Base TC57 | `PaymentPage` | Reusable - needs EPP wrapper | EPP payment configuration | Discover; do not assume Base modes |
| TC43 | Order | Registered | IM order with Trade-In and Samsung Care+ | Pass | Base TC59/service flows | `ProductPage`, `CartPage`, `CheckoutPage`, `PaymentPage` | Blocked | EPP IM SKU with both services plus approved payment | One guarded submit only |
| TC44 | Order | Registered | Place one CE order | Pass | Base TC60 | Checkout/order helpers | Blocked | EPP CE SKU, payment and address | One guarded submit only |
| TC45 | Confirmation | Registered | Order confirmation page | Pass | Base TC62 | `OrderConfirmationPage` | Blocked | Requires causal EPP order | Same execution as TC43 or TC44 |
| TC46 | Order Email | Registered | Confirmation/acknowledgment email | Pass | Base TC63 | `MailinatorPage` | Blocked | Requires same EPP order and QA inbox | Do not create a second order for email |
| TC47 | BackOffice | Admin | Login successfully | Pass | Base TC64 | `BackOfficePage` | Reusable - needs EPP wrapper | EPP BackOffice environment mapping | Runtime credentials only |
| TC48 | BackOffice | Admin | View order page in Admin | Pass | Base TC65 | `BackOfficePage`, `BackOfficeOrderPage` | Reusable - needs EPP wrapper | Correct EPP BackOffice | Read-only |
| TC49 | BackOffice | CS Agent | View order page in Customer Support | Pass | Base TC66 | `BackOfficePage`, `BackOfficeOrderPage` | Reusable - needs EPP wrapper | EPP authority/order type | Read-only |
| TC50 | BackOffice | CS Agent | Cancel an order | Pass | Base TC67-TC68 discovery | `BackOfficeOrderPage` | Blocked | Disposable EPP order in cancelable state | No random cancellation |
| TC51 | BackOffice | Admin | View CronJobs page | Pass | Base TC69 | `BackOfficeCronJobsPage` | Reusable - needs EPP wrapper | EPP BackOffice/job mapping | Read-only |
| TC52 | Fulfillment | Admin | Search EPP order | Pass | Base TC71 | `BackOfficeOrderPage` | Reusable - needs EPP wrapper | EPP order identifier | Read-only |
| TC53 | Fulfillment | Admin | Waiting for Send Financial | Pass | Base TC72 | `BackOfficeOrderPage` | Blocked | EPP causal order in exact pre-state | Do not use historical order |
| TC54 | Fulfillment | Admin | Run financial initial CronJob | Pass | Base TC73 | `BackOfficeCronJobsPage` | Blocked | Confirmed EPP job and eligible order | Staging only |
| TC55 | Fulfillment | Admin | Status becomes Order Split | Pass | Base TC74 | `BackOfficeOrderPage` | Blocked | Same order from TC53/TC54 | Causal validation |
| TC56 | Fulfillment | Admin | Run warehouse transfer CronJob | Pass | Base TC75 | `BackOfficeCronJobsPage` | Blocked | Confirmed EPP job and Order Split mass | Staging only |
| TC57 | Fulfillment | Admin | Status becomes Shipping Requested | Pass | Base TC76 | `BackOfficeOrderPage` | Blocked | Same order from TC55/TC56 | Causal validation |
| TC58 | Payment | Registered | Complete orders with at least two payment modes | Pass | Base TC77-TC82 | `PaymentPage`, order helpers | Blocked | Two proven EPP staging modes and two authorized orders | Never reuse Base Store mode assumptions |
| TC59 | Mobile | Registered | Place registered EPP mobile order | Pass | Base TC83/mobile smoke | Checkout/order helpers plus mobile project config | Blocked | EPP mobile route, entitlement, SKU and payment | One guarded submit; no retry |

## Reuse analysis

| Group | TCs | Candidate reuse | Current conclusion |
|---|---:|---|---|
| Login/My Account/Tracking | 9 | 9 | Shared auth, profile, orders, email and OTP helpers; EPP entitlement remains unknown |
| Homepage | 1 | 1 | `HomePage` candidate; EPP DOM must be observed |
| Cart/Services | 8 | 8 | Product/cart/service helpers; new EPP SKUs required |
| Checkout/Address/Delivery | 19 | 19 | `CheckoutPage` and QA-address safety model are reusable |
| Payment/Orders/Email | 9 | 9 | Payment, confirmation and inbox helpers; causal EPP order required |
| BackOffice/Fulfillment | 11 | 11 | Existing pages cover login, orders and jobs; EPP environment/mass unknown |
| Mobile | 1 | 1 | Existing mobile viewport/order structure; EPP registered flow unknown |
| **Total** | **59** | **59** | No scenario is Automated until real EPP execution |
