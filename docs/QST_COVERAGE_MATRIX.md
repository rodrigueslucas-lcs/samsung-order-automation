# QST Peru Coverage Matrix

This matrix is separate from DST coverage. `Automated` requires a successful QST execution; a similar DST test is only reuse evidence.

Legend: **A** = Available, **If needed** = applicable for targeted changes, **N/A** = not applicable in the supplied QST definition.

## Base Store (22)

| ID | Functionality | User Type | Scenario | Normal | Modified | Sanity | Existing reusable automation | Page Object/helper | Current QST status | Dependency/blocker | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| QST-BS-01 | Homepage | Guest/Registered | Header, hero, top seller, footer | A | A | A | DST TC14 | HomePage | Partial | ST2 may not expose hero/top seller markers | Safe QST wrapper implemented; header/footer are strict |
| QST-BS-02 | PLP+PDP | Guest | Open PLP from main navigation | A | N/A | N/A | None verified | None verified | Blocked | ST2 category navigation points to Production; no safe staging PLP route | Production navigation deliberately refused |
| QST-BS-03 | PLP+PDP | Guest | Product details, facets, variant button on PLP | A | N/A | N/A | None verified | None verified | Blocked | No staging PLP is reachable for DOM validation | Depends on a real ST2 PLP route |
| QST-BS-04 | PLP+PDP | Guest | Navigate to Hybris PDP | A | A | N/A | Existing PDP specs | ProductPage | Automated | None for current ST2 SKU | QST wrapper passed in Chrome |
| QST-BS-05 | PLP+PDP | Guest | Non-color variants displayed on PDP | A | N/A | N/A | PDP color variant evidence only | ProductPage | Partial | No verified non-color variant mass/locator | Do not equate color coverage with this scenario |
| QST-BS-06 | Cart | Guest | Add to Cart | A | A | N/A | DST TC15/TC16 setup | ProductPage, CartPage | Automated | None for current ST2 SKU | QST wrapper passed in Chrome |
| QST-BS-07 | Cart | Guest | Cart page displayed properly | A | N/A | N/A | DST TC15/TC16 | CartPage | Automated | None for current ST2 SKU | QST wrapper passed in Chrome |
| QST-BS-08 | Cart | Guest | Order summary on right side | A | N/A | N/A | DST TC18 | CartPage | Automated | None for current ST2 SKU | QST wrapper passed in Chrome |
| QST-BS-09 | Cart | Guest | Add Trade-In services | A | If needed | N/A | DST TC23-TC27 | ProductPage, CartPage | Automated | None for current two-SKU ST2 setup | QST wrapper passed; Cart-only mutation |
| QST-BS-10 | Cart | Guest | Add Samsung Care+ services | A | If needed | N/A | DST TC28-TC32 | ProductPage, CartPage | Partial | Known DST blocker reused: SC+ is removed at Checkout because service/stock is unavailable | No workaround search until valid mass exists |
| QST-BS-11 | Cart | Guest | Navigate to Checkout | A | A | N/A | DST TC33 | ProductPage, CartPage | Automated | None for guest-login boundary | Passed and stopped at guest login; no order |
| QST-BS-12 | Checkout | Guest | Enter addresses | A | A | N/A | DST TC35/TC42-TC47 | CheckoutPage, GuestLoginPage | Automated | None for current QA address | Passed without saving address or advancing to payment |
| QST-BS-13 | Payment | Guest | Complete order with available payment | A | A | N/A | DST TC58/TC77 | PaymentPage, CheckoutPage | Automated | Guarded execution only | One ST2 Credit Card test order; `ALLOW_PAYMENT_SUBMIT=1` preserved |
| QST-BS-14 | Confirmation | Guest | Order confirmation page | A | A | N/A | DST TC62 E2E step | OrderConfirmationPage | Automated | Same causal execution as BS-13 | Confirmed order PE260828-74965010 |
| QST-BS-15 | Login | Registered | Login via Home Page | A | A | A | Authenticated DST/profile flows | authState, HomePage, ProfilePage | Automated | Valid ignored QA auth state required | Passed without MFA or Production navigation |
| QST-BS-16 | Customer Order Fulfillment Journey | Registered | Place order with different payment mode from guest | A | N/A | A | Authenticated checkout DST | authState, CheckoutPage, PaymentPage, MyOrdersPage | Reusable - needs successful QST execution | Pago Efectivo `submitOrder` returned HTTP 200 with functional error `code=601`, `payment generic error` | No provider URL/CIP/order code or new My Orders entry; submit was not retried |
| QST-BS-17 | Confirmation Email | Registered | Order confirmation email | A | N/A | N/A | DST TC63/Mailinator evidence | MailinatorPage | Blocked | BS-16 produced no registered order code to correlate with an inbox message | No second order was created to force delivery |
| QST-BS-18 | BackOffice | Admin | Login in BackOffice | A | N/A | N/A | DST TC64 | BackOfficePage | Automated | None for S1 runtime credentials | Passed headed in S1; direct full-admin Administration Cockpit flow |
| QST-BS-19 | Order Fulfillment | Admin | See order status | A | N/A | N/A | DST TC71/72/74/76 | BackOfficeOrderPage | Automated | None for read-only S1 Admin order | Passed headed with order PE260805-63779426 and status completed |
| QST-BS-20 | Order Fulfillment | Admin | Run financial initial CronJob | A | N/A | N/A | DST TC73 | BackOfficeCronJobsPage | Blocked | All 50 accessible S1 Admin orders are COMPLETED; no eligible financial pre-state | Exact S1 job found FINISHED/SUCCESS; zero Runs |
| QST-BS-21 | Order Fulfillment | Admin | Run warehouse transfer CronJob | A | N/A | N/A | DST TC75 | BackOfficeCronJobsPage | Blocked | All 50 accessible S1 Admin orders are COMPLETED; no Order Split mass | Exact S1 job found; zero Runs |
| QST-BS-22 | Order Fulfillment | Admin | Status becomes Shipping Requested | A | N/A | N/A | DST TC76 | BackOfficeOrderPage | Blocked | No Shipping Requested order among all 50 accessible S1 Admin orders | Read-only scan completed; no S2/S3 code transplanted to S1 |

## EPP Store (22)

No verified EPP URL, store identifier, auth/profile, credentials, fixtures, test mass or compatible DOM implementation exists in this repository. The rows remain blocked rather than copying Base Store specs under EPP names.

| ID | Functionality | User Type | Scenario | Normal | Modified | Sanity | Existing reusable automation | Page Object/helper | Current QST status | Dependency/blocker | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| QST-EPP-01 | Homepage | Registered | Header, hero, top seller, footer | A | A | A | Base Store DST is only a candidate | HomePage candidate | Blocked | EPP URL/auth/DOM not verified | No Base Store assumptions |
| QST-EPP-02 | PLP+PDP | Registered | Open PLP from main navigation | A | N/A | N/A | None verified | None verified | Blocked | EPP URL/auth and PLP implementation absent | Requires new verified code |
| QST-EPP-03 | PLP+PDP | Registered | PLP details, facets, variant button | A | N/A | N/A | None verified | None verified | Blocked | EPP URL/auth and PLP implementation absent | Requires new verified code |
| QST-EPP-04 | PLP+PDP | Registered | Navigate to Hybris PDP | A | A | N/A | Base Store PDP is only a candidate | ProductPage candidate | Blocked | EPP URL/auth/product/DOM not verified | Compatibility must be proven |
| QST-EPP-05 | PLP+PDP | Registered | Non-color variants on PDP | A | N/A | N/A | Color-only Base Store evidence | ProductPage candidate | Blocked | EPP product mass and variants unknown | Compatibility must be proven |
| QST-EPP-06 | Cart | Registered | Add to Cart | A | A | N/A | Base Store cart is only a candidate | ProductPage, CartPage candidates | Blocked | EPP auth/SKU/cart APIs unknown | No copied spec |
| QST-EPP-07 | Cart | Registered | Cart page displayed properly | A | N/A | N/A | Base Store cart is only a candidate | CartPage candidate | Blocked | EPP auth/cart DOM unknown | Compatibility must be proven |
| QST-EPP-08 | Cart | Registered | Order summary on right side | A | N/A | N/A | Base Store DST TC18 candidate | CartPage candidate | Blocked | EPP auth/cart DOM unknown | Compatibility must be proven |
| QST-EPP-09 | Cart | Registered | Add Trade-In services | A | If needed | N/A | Base Store DST TC23-TC27 candidate | ProductPage, CartPage candidates | Blocked | EPP eligibility/mass/DOM unknown | Service availability must be proven |
| QST-EPP-10 | Cart | Registered | Add Samsung Care+ services | A | If needed | N/A | Base Store DST TC28-TC32 candidate | ProductPage, CartPage candidates | Blocked | EPP eligibility/mass/DOM unknown | Service availability must be proven |
| QST-EPP-11 | Cart | Registered | Navigate to Checkout | A | A | N/A | Base Store DST TC33 candidate | CartPage candidate | Blocked | EPP auth/checkout route unknown | Compatibility must be proven |
| QST-EPP-12 | Checkout | Registered | Enter addresses | A | A | N/A | Base Store checkout candidate | CheckoutPage candidate | Blocked | EPP account/address UI unknown | QA account data required |
| QST-EPP-13 | Payment | Registered | Complete order with available payment | A | A | N/A | DST guarded payment candidate | PaymentPage candidate | Blocked | EPP auth/payment/mass and guard validation | Destructive; not executed |
| QST-EPP-14 | Confirmation | Registered | Order confirmation page | A | A | N/A | DST confirmation candidate | OrderConfirmationPage candidate | Blocked | Depends on safe EPP order creation | Destructive causal flow |
| QST-EPP-15 | Login | Registered | Login via Home Page | A | A | A | Base Store auth pattern only | authState candidate | Blocked | EPP login/bootstrap/profile absent | First EPP prerequisite |
| QST-EPP-16 | Customer Order Fulfillment Journey | Registered | Place registered order | A | N/A | N/A | Authenticated DST candidate | CheckoutPage, PaymentPage candidates | Blocked | EPP auth/payment/test data absent | Destructive; no Sanity per source |
| QST-EPP-17 | Confirmation Email | Registered | Order confirmation email | A | N/A | N/A | DST TC63 pattern candidate | MailinatorPage candidate | Blocked | EPP order/email/inbox behavior unknown | Requires safely created EPP order |
| QST-EPP-18 | BackOffice | Admin | Login in BackOffice | A | N/A | N/A | DST TC64 | BackOfficePage | Blocked | EPP-specific environment/order domain not identified | Common BO code is a candidate only |
| QST-EPP-19 | Order Fulfillment | Admin | See order status | A | N/A | N/A | DST TC71/72/74/76 | BackOfficeOrderPage | Blocked | EPP order identification/mass absent | Read-only after environment mapping |
| QST-EPP-20 | Order Fulfillment | Admin | Run financial initial CronJob | A | N/A | N/A | DST TC73 | BackOfficeCronJobsPage | Blocked | EPP environment/job eligibility absent | Destructive; not executed |
| QST-EPP-21 | Order Fulfillment | Admin | Run warehouse transfer CronJob | A | N/A | N/A | DST TC75 | BackOfficeCronJobsPage | Blocked | EPP environment/job eligibility absent | Destructive; not executed |
| QST-EPP-22 | Order Fulfillment | Admin | Status becomes Shipping Requested | A | N/A | N/A | DST TC76 | BackOfficeOrderPage | Blocked | EPP order flow/mass absent | Causal fulfillment not executed |

## Current totals after initial safe QST execution

| Status | Count |
|---|---:|
| Automated | 12 |
| Reusable - needs QST wrapper | 1 |
| Partial | 3 |
| Blocked | 28 |
| Not implemented | 0 |
| N/A | 0 |
| **Total** | **44** |
