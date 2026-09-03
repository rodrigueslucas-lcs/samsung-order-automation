# MX S1 Quick Smoke Test — Base Store

`Automated` requires a successful MX QST execution. `Implemented — not run` means a guarded QST wrapper exists but has not performed its destructive action. DST/manual evidence is reuse evidence, not a QST pass.

| ID | Scenario | Initial status | Evidence / dependency |
|---|---|---|---|
| QST 01 | Homepage | Not implemented | Explicitly outside this batch. |
| QST 02 | Open PLP from navigation | Not implemented | Explicitly outside this batch. |
| QST 03 | PLP details/facets/variant | Not implemented | Explicitly outside this batch. |
| QST 04 | Navigate to PDP | Automated | Headed Chrome passed using the configured MX PDP flow. |
| QST 05 | PDP variants other than color | Automated | Headed Chrome passed with `SM-F741BLBKLTM`; 256GB/512GB were validated separately from the color controls. |
| QST 06 | Add to Cart | Automated | Headed Chrome passed in the same causal safe wrapper as QST 07/08. |
| QST 07 | Cart displayed | Automated | Headed Chrome passed using `CartPage`. |
| QST 08 | Order summary | Automated | Headed Chrome validated subtotal and total using `CartPage`. |
| QST 09 | Add Trade-In | Partial | Headed Chrome opened the real Galaxy Canje journey and validated its device-selection UI; a complete valuation/application was not performed, so it is not promoted. |
| QST 10 | Add Samsung Care+ | Automated | Headed Chrome selected the current Care+ option, accepted all displayed terms, added it, and found Care+ still associated in Cart. No checkout/order. |
| QST 11 | Navigate to Checkout | Automated | Headed Chrome reached the guest boundary; no order. |
| QST 12 | Enter address | Automated | Headed Chrome reused `reachMxGuestPayment`, validated postal lookup/colonia and reached Payment without submit. |
| QST 13 | Guest order with available payment | Implemented — not run | Guarded Guest SPEI; `@destructive`; exactly one submit. |
| QST 14 | Guest order confirmation | Implemented — not run | Same causal order as QST 13. |
| QST 15 | Registered login | Blocked | The exported MX auth state did not render `My Profile` during the authenticated fixture validation; no account mutation occurred. |
| QST 16 | Registered order, payment different from Guest | Implemented — not run | Guarded registered Amex / `mx-mercadoCC`; one submit. |
| QST 17 | Confirmation email | Not implemented | Explicitly outside this batch. |
| QST 18 | BackOffice login | Blocked | Two headed attempts reached the S1 URL but the gateway returned HTTP 403 before the login form; credentials were not submitted. |
| QST 19 | See order status | Blocked | `MX260903-63905850` was configured, but the same pre-login S1 HTTP 403 prevented the read-only search. |
| QST 20 | Run financial initial CronJob | Blocked | Explicitly excluded; no CronJob execution in this batch. |
| QST 21 | Run warehouse transfer CronJob | Blocked | Explicitly excluded; no CronJob execution in this batch. |
| QST 22 | Shipping Requested | Not implemented | Explicitly outside this batch. |

## Safety

- S1 MX only (`stg.shop.samsung.com`); Production is read-only and is never an execution target.
- QST 13/14 and 16 require `ALLOW_PAYMENT_SUBMIT=1`, `--workers=1`, and `--retries=0`.
- Each destructive wrapper performs one submit only and explicitly forbids blind retry when no order code is observable.
- QST 18/19 are read-only; cancellation and CronJob execution are absent.

## Current totals

| Status | Count |
|---|---:|
| Automated | 8 |
| Partial | 1 |
| Implemented — not run | 3 |
| Blocked | 5 |
| Not implemented | 5 |
| **Total** | **22** |
