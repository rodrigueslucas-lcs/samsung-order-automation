# DST Phase 1: legacy reconciliation and first pilot

## Scope and source authority

The current official snapshots contain **362 DST scenarios (144 P1 + 218 P2)** across MX, PE, CO and CL. Source hashes are pinned in [pilot contracts](../governance/dst-pilot.json). SAM identities use the existing explicit crosswalk in officialRowEvidence; no SAM was inferred from a legacy title or TC number.

The snapshots contain scenario text, priority and country, **not formal preconditions, steps or expected-result fields**. The read-only Jira definition request returned HTTP 401. Every pilot therefore records SCENARIO_ONLY and PENDING_OFFICIAL_DEFINITION. A successful available-scenario assertion is not full formal DST homologation. Obtain the approved Jira/Zephyr definition export before closing that gap.

## Legacy results

Baseline commit: b6ec2bee8da674e40e789e618067e1d70119de07. Playwright discovery collected **143 instances in 36 files**: MX 22 and PE 121. The callback audit inspected all 143 bodies, their actions/assertions and imported Page Object methods. Historical titles, file/line, file and callback SHA-256, source row and confidence are retained in [the reconciliation matrix](../governance/dst-reconciliation.json). Parameterized instances remain separate.

- 85 instances have behavior-based candidate matches to 55 distinct current source rows.
- 2 instances match the available scenario exactly; the remaining 83 have only partial behavior or prerequisites. Formal definition and runtime proof are separate for all of them.
- 58 instances have no sufficiently supported correspondence. No executable SAM identity was assigned to those tests.
- Login/listing alone is not BackOffice search or shipping coverage; opening PDP is not Add to Cart; recommendations are not purchased-together; confirmation email is not cancellation email.
- Discovery output is not runtime, even when Playwright labels undispatched results as skipped.

## Pilot implementation

Five existing legacy owners were strengthened/renamed, not duplicated: MX cart presentation, quantity and checkout; PE summary and checkout. Two absent scenarios were added: MX BC and PE Rewards. The original 36-file baseline remains auditable; discovery now contains 145 instances in 38 files.

| ID | Current source | Implemented scenario assertions | Definition |
| --- | --- | --- | --- |
| SAM-24969 | MX-BASE_STORE-9 | Native BC catalog and exact configured variant; Successful native Add response; SKU quantity increases by one; Quantity persists after cart reload | Scenario only |
| SAM-24971 | MX-BASE_STORE-11 | SKU name; Item price; Product thumbnail; Available services if any; Order summary; Info icons; Footer section | Scenario only |
| SAM-24972 | MX-BASE_STORE-12 | Increase quantity; Decrease quantity; Delete product; Persisted empty cart | Scenario only |
| SAM-24988 | MX-BASE_STORE-28 | Native checkout CTA click; Correct market checkout entry visible | Scenario only |
| SAM-25064 | PE-BASE_STORE-11 | Summary on right of cart items; Coupon code field; View available coupons control; Subtotal; Total savings; Total; Info text | Scenario only |
| SAM-25065 | PE-BASE_STORE-12 | Rewards text on cart; Rewards text on checkout; Rewards text on payment; No payment submission | Scenario only |
| SAM-25081 | PE-BASE_STORE-28 | Native checkout CTA click; Correct market checkout entry visible | Scenario only |

Business reuse: flows/mx/bcAddToCart.js is shared by QST and DST; flows/pe/storefrontCheckout.js owns the existing PE navigation. The old QST helper is a compatibility export for active QST consumers, not duplicated logic. New source-clause assertions are in flows/smb/dstCartAssertions.js. Authentication is reused/read-only, with no refresh, export or login initiated by the pilot. Existing operator tabs are preserved; BC owns and closes its own CDP tab.

The [362-row phase matrix](../governance/dst-phase1-coverage.json) separates unmapped scope, legacy candidates, pilot implementation and actual DST runtime evidence. QST results are not promoted.

## Running targeted pilots

Git Bash examples, one market at a time:

```bash
# Discovery only; does not require or renew authentication.
DST_TARGET_IDS=SAM-24969,SAM-24971,SAM-24972,SAM-24988 npm run dst:pilot -- MX --list
DST_TARGET_IDS=SAM-25064,SAM-25065,SAM-25081 npm run dst:pilot -- PE --list

# Actual safe pilot, independent IDs may also be selected individually.
DST_ENVIRONMENT=S2 DST_TARGET_IDS=SAM-24971,SAM-24972,SAM-24988 BROWSER_MODE=headed npm run dst:pilot -- MX
DST_ENVIRONMENT=S2 DST_TARGET_IDS=SAM-25064,SAM-25065,SAM-25081 BROWSER_MODE=headed npm run dst:pilot -- PE

# BC specifically requires S2 plus the existing authorized PreQA2 CDP session.
DST_ENVIRONMENT=S2 DST_TARGET_IDS=SAM-24969 npm run dst:pilot -- MX
```

Without explicit IDs the command stops. Unknown/cross-market IDs and BC on S1 stop. Defaults: S2, headless, one worker, retries 0, independent run directory under test-results/dst-pilot. Base Store market leases prevent conflicting campaigns/auth recovery. Payment/order submission and profile-write gates are forced off; the request guard blocks financial mutations even if an ALLOW flag is exported. Cart add/quantity/delete and checkout preparation are required pilot effects; no order is placed. No full DST campaign or Jenkins build is started.

SAM-25065 requires a live registered PE identity and checkout delivery data. It verifies Rewards on cart, checkout and payment before stopping. Missing Rewards is a real assertion failure; there is no cart-only fallback. SAM-25064 verifies the existing PE registered identity first: read-only comparison of the same cart proved the coupon link and savings absent for guest and present after authentication. This is an evidence-backed operational precondition, not an invented formal source field. It verifies coupons, savings, information and right-side desktop placement; subtotal equality is not an official criterion. Both registered pilots share flows/pe/existingIdentity.js, which does not renew or export sessions.

## Legacy correspondence index

EXACT_SCENARIO and PARTIAL below apply only to available scenario text, not complete formal definitions. NONE preserves the legacy without an invented association. Full method-level provenance and gaps are in the JSON matrix.

| Instance | Legacy source | Behavior matches | Confidence |
| --- | --- | --- | --- |
| MX-001 | [backoffice/backoffice.spec.js:11](../tests/markets/mx/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| MX-002 | [backoffice/backoffice.spec.js:20](../tests/markets/mx/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| MX-003 | [backoffice/backoffice.spec.js:30](../tests/markets/mx/dst/backoffice/backoffice.spec.js) | MX-BASE_STORE-51 (SAM-25011): PARTIAL | MEDIUM |
| MX-004 | [backoffice/backoffice.spec.js:41](../tests/markets/mx/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| MX-005 | [backoffice/backoffice.spec.js:50](../tests/markets/mx/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| MX-006 | [base-store/authenticated.spec.js:29](../tests/markets/mx/dst/base-store/authenticated.spec.js) | MX-BASE_STORE-2 (SAM-24962): PARTIAL | MEDIUM |
| MX-007 | [base-store/authenticated.spec.js:42](../tests/markets/mx/dst/base-store/authenticated.spec.js) | MX-BASE_STORE-6: PARTIAL | MEDIUM |
| MX-008 | [base-store/authenticated.spec.js:53](../tests/markets/mx/dst/base-store/authenticated.spec.js) | MX-BASE_STORE-27: PARTIAL | MEDIUM |
| MX-009 | [base-store/authenticated.spec.js:63](../tests/markets/mx/dst/base-store/authenticated.spec.js) | MX-BASE_STORE-30 (SAM-24990): PARTIAL<br>MX-BASE_STORE-34 (SAM-24994): PARTIAL | MEDIUM, MEDIUM |
| MX-010 | [base-store/checkout.spec.js:4](../tests/markets/mx/dst/base-store/checkout.spec.js) | MX-BASE_STORE-29 (SAM-24989): PARTIAL<br>MX-BASE_STORE-30 (SAM-24990): PARTIAL<br>MX-BASE_STORE-34 (SAM-24994): PARTIAL | MEDIUM, MEDIUM, MEDIUM |
| MX-011 | [base-store/email.spec.js:4](../tests/markets/mx/dst/base-store/email.spec.js) | MX-BASE_STORE-48: PARTIAL | MEDIUM |
| MX-012 | [base-store/order.spec.js:7](../tests/markets/mx/dst/base-store/order.spec.js) | NONE | No assignment |
| MX-013 | [base-store/registered-card-order.spec.js:17](../tests/markets/mx/dst/base-store/registered-card-order.spec.js) | MX-BASE_STORE-42 (SAM-25002): PARTIAL | MEDIUM |
| MX-014 | [base-store/storefront.spec.js:27](../tests/markets/mx/dst/base-store/storefront.spec.js) | NONE | No assignment |
| MX-015 | [base-store/storefront.spec.js:45](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-3 (SAM-24963): PARTIAL | MEDIUM |
| MX-016 | [base-store/storefront.spec.js:66](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-10: PARTIAL | MEDIUM |
| MX-017 | [base-store/storefront.spec.js:76](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-11 (SAM-24971): PARTIAL<br>MX-BASE_STORE-13: PARTIAL | MEDIUM, MEDIUM |
| MX-018 | [base-store/storefront.spec.js:87](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-11 (SAM-24971): PARTIAL | MEDIUM |
| MX-019 | [base-store/storefront.spec.js:96](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-12 (SAM-24972): PARTIAL | MEDIUM |
| MX-020 | [base-store/storefront.spec.js:102](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-28 (SAM-24988): EXACT_SCENARIO | HIGH |
| MX-021 | [base-store/storefront.spec.js:115](../tests/markets/mx/dst/base-store/storefront.spec.js) | MX-BASE_STORE-30 (SAM-24990): PARTIAL | MEDIUM |
| MX-022 | [base-store/storefront.spec.js:132](../tests/markets/mx/dst/base-store/storefront.spec.js) | NONE | No assignment |
| PE-023 | [backoffice/backoffice-fulfillment.spec.js:43](../tests/markets/pe/dst/backoffice/backoffice-fulfillment.spec.js) | PE-BASE_STORE-47 (SAM-25104): PARTIAL | MEDIUM |
| PE-024 | [backoffice/backoffice-fulfillment.spec.js:56](../tests/markets/pe/dst/backoffice/backoffice-fulfillment.spec.js) | PE-BASE_STORE-47 (SAM-25104): PARTIAL | MEDIUM |
| PE-025 | [backoffice/backoffice-fulfillment.spec.js:74](../tests/markets/pe/dst/backoffice/backoffice-fulfillment.spec.js) | PE-BASE_STORE-47 (SAM-25104): PARTIAL | MEDIUM |
| PE-026 | [backoffice/backoffice-fulfillment.spec.js:96](../tests/markets/pe/dst/backoffice/backoffice-fulfillment.spec.js) | PE-BASE_STORE-47 (SAM-25104): PARTIAL | MEDIUM |
| PE-027 | [backoffice/backoffice-fulfillment.spec.js:114](../tests/markets/pe/dst/backoffice/backoffice-fulfillment.spec.js) | PE-BASE_STORE-47 (SAM-25104): PARTIAL | MEDIUM |
| PE-028 | [backoffice/backoffice.spec.js:31](../tests/markets/pe/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| PE-029 | [backoffice/backoffice.spec.js:39](../tests/markets/pe/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| PE-030 | [backoffice/backoffice.spec.js:48](../tests/markets/pe/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| PE-031 | [backoffice/backoffice.spec.js:57](../tests/markets/pe/dst/backoffice/backoffice.spec.js) | NONE | No assignment |
| PE-032 | [backoffice/backoffice.spec.js:75](../tests/markets/pe/dst/backoffice/backoffice.spec.js) | PE-BASE_STORE-46 (SAM-25103): PARTIAL | MEDIUM |
| PE-033 | [cart/cart-negative.spec.js:11](../tests/markets/pe/dst/base-store/cart/cart-negative.spec.js) | PE-BASE_STORE-10: PARTIAL | MEDIUM |
| PE-034 | [cart/cart-negative.spec.js:30](../tests/markets/pe/dst/base-store/cart/cart-negative.spec.js) | PE-BASE_STORE-14: PARTIAL | MEDIUM |
| PE-035 | [cart/cart.spec.js:8](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-10: PARTIAL | MEDIUM |
| PE-036 | [cart/cart.spec.js:23](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-11 (SAM-25064): PARTIAL | MEDIUM |
| PE-037 | [cart/cart.spec.js:42](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-28 (SAM-25081): PARTIAL | MEDIUM |
| PE-038 | [cart/cart.spec.js:56](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-9 (SAM-25062): PARTIAL | MEDIUM |
| PE-039 | [cart/cart.spec.js:68](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-9 (SAM-25062): PARTIAL | MEDIUM |
| PE-040 | [cart/cart.spec.js:80](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-28 (SAM-25081): EXACT_SCENARIO | HIGH |
| PE-041 | [cart/cart.spec.js:102](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-9 (SAM-25062): PARTIAL | MEDIUM |
| PE-042 | [cart/cart.spec.js:121](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-9 (SAM-25062): PARTIAL<br>PE-BASE_STORE-21 (SAM-25074): PARTIAL | MEDIUM, MEDIUM |
| PE-043 | [cart/cart.spec.js:131](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-9 (SAM-25062): PARTIAL | MEDIUM |
| PE-044 | [cart/cart.spec.js:149](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-21 (SAM-25074): PARTIAL | MEDIUM |
| PE-045 | [cart/cart.spec.js:171](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-21 (SAM-25074): PARTIAL | MEDIUM |
| PE-046 | [cart/cart.spec.js:181](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-22 (SAM-25075): PARTIAL | MEDIUM |
| PE-047 | [cart/cart.spec.js:197](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-22 (SAM-25075): PARTIAL | MEDIUM |
| PE-048 | [cart/cart.spec.js:211](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-22 (SAM-25075): PARTIAL | MEDIUM |
| PE-049 | [cart/cart.spec.js:224](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-22 (SAM-25075): PARTIAL | MEDIUM |
| PE-050 | [cart/cart.spec.js:238](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-22 (SAM-25075): PARTIAL | MEDIUM |
| PE-051 | [cart/cart.spec.js:253](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-21 (SAM-25074): PARTIAL | MEDIUM |
| PE-052 | [cart/cart.spec.js:271](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-21 (SAM-25074): PARTIAL | MEDIUM |
| PE-053 | [cart/cart.spec.js:307](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | PE-BASE_STORE-21 (SAM-25074): PARTIAL | MEDIUM |
| PE-054 | [cart/cart.spec.js:351](../tests/markets/pe/dst/base-store/cart/cart.spec.js) | NONE | No assignment |
| PE-055 | [checkout/authenticated-checkout.spec.js:77](../tests/markets/pe/dst/base-store/checkout/authenticated-checkout.spec.js) | PE-BASE_STORE-30: PARTIAL<br>PE-BASE_STORE-34 (SAM-25087): PARTIAL | MEDIUM, MEDIUM |
| PE-056 | [checkout/authenticated-checkout.spec.js:90](../tests/markets/pe/dst/base-store/checkout/authenticated-checkout.spec.js) | PE-BASE_STORE-32 (SAM-25085): PARTIAL | MEDIUM |
| PE-057 | [checkout/authenticated-checkout.spec.js:96](../tests/markets/pe/dst/base-store/checkout/authenticated-checkout.spec.js) | PE-BASE_STORE-54 (SAM-25097): PARTIAL | MEDIUM |
| PE-058 | [checkout/authenticated-checkout.spec.js:103](../tests/markets/pe/dst/base-store/checkout/authenticated-checkout.spec.js) | PE-BASE_STORE-53 (SAM-25096): PARTIAL | MEDIUM |
| PE-059 | [checkout/authenticated-checkout.spec.js:110](../tests/markets/pe/dst/base-store/checkout/authenticated-checkout.spec.js) | NONE | No assignment |
| PE-060 | [checkout/authenticated-checkout.spec.js:117](../tests/markets/pe/dst/base-store/checkout/authenticated-checkout.spec.js) | PE-BASE_STORE-52 (SAM-25095): PARTIAL | MEDIUM |
| PE-061 | [checkout/checkout.spec.js:12](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-062 | [checkout/checkout.spec.js:26](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-063 | [checkout/checkout.spec.js:37](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-064 | [checkout/checkout.spec.js:54](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-30: PARTIAL<br>PE-BASE_STORE-34 (SAM-25087): PARTIAL | MEDIUM, MEDIUM |
| PE-065 | [checkout/checkout.spec.js:76](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-066 | [checkout/checkout.spec.js:99](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-29: PARTIAL | MEDIUM |
| PE-067 | [checkout/checkout.spec.js:120](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-29: PARTIAL | MEDIUM |
| PE-068 | [checkout/checkout.spec.js:141](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-30: PARTIAL | MEDIUM |
| PE-069 | [checkout/checkout.spec.js:161](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-34 (SAM-25087): PARTIAL | MEDIUM |
| PE-070 | [checkout/checkout.spec.js:183](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-34 (SAM-25087): PARTIAL | MEDIUM |
| PE-071 | [checkout/checkout.spec.js:205](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-34 (SAM-25087): PARTIAL | MEDIUM |
| PE-072 | [checkout/checkout.spec.js:223](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-34 (SAM-25087): PARTIAL | MEDIUM |
| PE-073 | [checkout/checkout.spec.js:241](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-074 | [checkout/checkout.spec.js:250](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-35 (SAM-25088): PARTIAL | MEDIUM |
| PE-075 | [checkout/checkout.spec.js:270](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-36 (SAM-25089): PARTIAL | MEDIUM |
| PE-076 | [checkout/checkout.spec.js:290](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-37 (SAM-25090): PARTIAL | MEDIUM |
| PE-077 | [checkout/checkout.spec.js:312](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-40: PARTIAL | MEDIUM |
| PE-078 | [checkout/checkout.spec.js:334](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-079 | [checkout/checkout.spec.js:342](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | PE-BASE_STORE-26 (SAM-25079): PARTIAL | MEDIUM |
| PE-080 | [checkout/checkout.spec.js:363](../tests/markets/pe/dst/base-store/checkout/checkout.spec.js) | NONE | No assignment |
| PE-081 | [guest-login/guest-login.spec.js:7](../tests/markets/pe/dst/base-store/guest-login/guest-login.spec.js) | NONE | No assignment |
| PE-082 | [home/home.spec.js:6](../tests/markets/pe/dst/base-store/home/home.spec.js) | NONE | No assignment |
| PE-083 | [home/login.spec.js:19](../tests/markets/pe/dst/base-store/home/login.spec.js) | PE-BASE_STORE-2 (SAM-25055): PARTIAL | MEDIUM |
| PE-084 | [home/login.spec.js:25](../tests/markets/pe/dst/base-store/home/login.spec.js) | PE-BASE_STORE-2 (SAM-25055): PARTIAL | MEDIUM |
| PE-085 | [home/tracking.spec.js:6](../tests/markets/pe/dst/base-store/home/tracking.spec.js) | PE-BASE_STORE-45: PARTIAL | MEDIUM |
| PE-086 | [mobile/mobile-order.spec.js:16](../tests/markets/pe/dst/base-store/mobile/mobile-order.spec.js) | PE-BASE_STORE-50: PARTIAL<br>PE-BASE_STORE-52 (SAM-25095): PARTIAL | MEDIUM, MEDIUM |
| PE-087 | [mobile/mobile.spec.js:10](../tests/markets/pe/dst/base-store/mobile/mobile.spec.js) | PE-BASE_STORE-50: PARTIAL | MEDIUM |
| PE-088 | [payment/alternative-payment-submit.spec.js:16](../tests/markets/pe/dst/base-store/payment/alternative-payment-submit.spec.js) | NONE | No assignment |
| PE-089 | [payment/payment-navigation.spec.js:11](../tests/markets/pe/dst/base-store/payment/payment-navigation.spec.js) | NONE | No assignment |
| PE-090 | [payment/payment.spec.js:70](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | NONE | No assignment |
| PE-091 | [payment/payment.spec.js:76](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | NONE | No assignment |
| PE-092 | [payment/payment.spec.js:82](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | PE-BASE_STORE-29: PARTIAL | MEDIUM |
| PE-093 | [payment/payment.spec.js:88](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | PE-BASE_STORE-32 (SAM-25085): PARTIAL<br>PE-BASE_STORE-36 (SAM-25089): PARTIAL | MEDIUM, MEDIUM |
| PE-094 | [payment/payment.spec.js:94](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | NONE | No assignment |
| PE-095 | [payment/payment.spec.js:100](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | PE-BASE_STORE-54 (SAM-25097): PARTIAL | MEDIUM |
| PE-096 | [payment/payment.spec.js:105](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | PE-BASE_STORE-53 (SAM-25096): PARTIAL | MEDIUM |
| PE-097 | [payment/payment.spec.js:110](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | NONE | No assignment |
| PE-098 | [payment/payment.spec.js:115](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | NONE | No assignment |
| PE-099 | [payment/payment.spec.js:129](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | NONE | No assignment |
| PE-100 | [payment/payment.spec.js:139](../tests/markets/pe/dst/base-store/payment/payment.spec.js) | PE-BASE_STORE-52 (SAM-25095): PARTIAL | MEDIUM |
| PE-101 | [pdp/pdp.spec.js:7](../tests/markets/pe/dst/base-store/pdp/pdp.spec.js) | NONE | No assignment |
| PE-102 | [pdp/product.spec.js:7](../tests/markets/pe/dst/base-store/pdp/product.spec.js) | NONE | No assignment |
| PE-103 | [pdp/product.spec.js:17](../tests/markets/pe/dst/base-store/pdp/product.spec.js) | NONE | No assignment |
| PE-104 | [pdp/product.spec.js:27](../tests/markets/pe/dst/base-store/pdp/product.spec.js) | NONE | No assignment |
| PE-105 | [profile/authenticated-profile.spec.js:36](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | PE-BASE_STORE-2 (SAM-25055): PARTIAL | MEDIUM |
| PE-106 | [profile/authenticated-profile.spec.js:42](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | PE-BASE_STORE-4 (SAM-25057): PARTIAL | MEDIUM |
| PE-107 | [profile/authenticated-profile.spec.js:68](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | NONE | No assignment |
| PE-108 | [profile/authenticated-profile.spec.js:74](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | NONE | No assignment |
| PE-109 | [profile/authenticated-profile.spec.js:91](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | NONE | No assignment |
| PE-110 | [profile/authenticated-profile.spec.js:108](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | NONE | No assignment |
| PE-111 | [profile/authenticated-profile.spec.js:108](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | NONE | No assignment |
| PE-112 | [profile/authenticated-profile.spec.js:127](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | PE-BASE_STORE-4 (SAM-25057): PARTIAL | MEDIUM |
| PE-113 | [profile/authenticated-profile.spec.js:140](../tests/markets/pe/dst/base-store/profile/authenticated-profile.spec.js) | NONE | No assignment |
| PE-114 | [profile/my-account-discovery.spec.js:28](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-115 | [profile/my-account-discovery.spec.js:28](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-116 | [profile/my-account-discovery.spec.js:28](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-117 | [profile/my-account-discovery.spec.js:28](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-118 | [profile/my-account-discovery.spec.js:28](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-119 | [profile/my-account-discovery.spec.js:28](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-120 | [profile/my-account-discovery.spec.js:42](../tests/markets/pe/dst/base-store/profile/my-account-discovery.spec.js) | NONE | No assignment |
| PE-121 | [search/search.spec.js:4](../tests/markets/pe/dst/base-store/search/search.spec.js) | NONE | No assignment |
| PE-122 | [smoke/authenticated-order.spec.js:27](../tests/markets/pe/dst/base-store/smoke/authenticated-order.spec.js) | NONE | No assignment |
| PE-123 | [smoke/guest-checkout.spec.js:41](../tests/markets/pe/dst/base-store/smoke/guest-checkout.spec.js) | NONE | No assignment |
| PE-124 | [smoke/guest-checkout.spec.js:49](../tests/markets/pe/dst/base-store/smoke/guest-checkout.spec.js) | PE-BASE_STORE-43: PARTIAL<br>PE-BASE_STORE-52 (SAM-25095): PARTIAL | MEDIUM, MEDIUM |
| PE-125 | [smoke/guest-checkout.spec.js:128](../tests/markets/pe/dst/base-store/smoke/guest-checkout.spec.js) | NONE | No assignment |
| PE-126 | [epp/account.spec.js:5](../tests/markets/pe/dst/epp/account.spec.js) | PE-EPP-1 (SAM-25109): PARTIAL | MEDIUM |
| PE-127 | [epp/account.spec.js:14](../tests/markets/pe/dst/epp/account.spec.js) | PE-EPP-3: PARTIAL | MEDIUM |
| PE-128 | [epp/backoffice.spec.js:20](../tests/markets/pe/dst/epp/backoffice.spec.js) | NONE | No assignment |
| PE-129 | [epp/backoffice.spec.js:26](../tests/markets/pe/dst/epp/backoffice.spec.js) | NONE | No assignment |
| PE-130 | [epp/backoffice.spec.js:33](../tests/markets/pe/dst/epp/backoffice.spec.js) | NONE | No assignment |
| PE-131 | [epp/backoffice.spec.js:42](../tests/markets/pe/dst/epp/backoffice.spec.js) | NONE | No assignment |
| PE-132 | [epp/bootstrap.spec.js:8](../tests/markets/pe/dst/epp/bootstrap.spec.js) | NONE | No assignment |
| PE-133 | [epp/cart.spec.js:4](../tests/markets/pe/dst/epp/cart.spec.js) | PE-EPP-6 (SAM-25114): PARTIAL<br>PE-EPP-8: PARTIAL | MEDIUM, MEDIUM |
| PE-134 | [epp/cart.spec.js:16](../tests/markets/pe/dst/epp/cart.spec.js) | PE-EPP-17 (SAM-25125): PARTIAL | MEDIUM |
| PE-135 | [epp/cart.spec.js:23](../tests/markets/pe/dst/epp/cart.spec.js) | PE-EPP-7: PARTIAL | MEDIUM |
| PE-136 | [epp/checkout.spec.js:4](../tests/markets/pe/dst/epp/checkout.spec.js) | PE-EPP-18: PARTIAL<br>PE-EPP-20: PARTIAL<br>PE-EPP-23: PARTIAL<br>PE-EPP-24: PARTIAL | MEDIUM, MEDIUM, MEDIUM, MEDIUM |
| PE-137 | [epp/checkout.spec.js:12](../tests/markets/pe/dst/epp/checkout.spec.js) | PE-EPP-19: PARTIAL | MEDIUM |
| PE-138 | [epp/checkout.spec.js:17](../tests/markets/pe/dst/epp/checkout.spec.js) | PE-EPP-23: PARTIAL | MEDIUM |
| PE-139 | [epp/checkout.spec.js:25](../tests/markets/pe/dst/epp/checkout.spec.js) | PE-EPP-25: PARTIAL<br>PE-EPP-16: PARTIAL | MEDIUM, MEDIUM |
| PE-140 | [epp/checkout.spec.js:34](../tests/markets/pe/dst/epp/checkout.spec.js) | NONE | No assignment |
| PE-141 | [epp/checkout.spec.js:40](../tests/markets/pe/dst/epp/checkout.spec.js) | PE-EPP-28: PARTIAL | MEDIUM |
| PE-142 | [epp/homepage.spec.js:4](../tests/markets/pe/dst/epp/homepage.spec.js) | NONE | No assignment |
| PE-143 | [epp/payment.spec.js:4](../tests/markets/pe/dst/epp/payment.spec.js) | PE-EPP-18: PARTIAL | MEDIUM |

## CO and CL next

Keep their DST ownership reservations untouched until this pilot review. Obtain formal definitions for the selected next scenarios, confirm explicit crosswalks, and reconcile behavior against each clause. Reuse shared Page Objects/flows, not executable QST specs. First choose safe cart/checkout cases with proven source identities and verified local sessions; do not start financial/BackOffice mutations or a full campaign from this phase. Preserve historical assessment and keep implementation, source completeness and runtime evidence distinct.

## Phase 1 runtime and validation evidence

All seven selected IDs were attempted in real S2 browser execution, not merely collected. Latest available-scenario results: **6 PASS, 0 FAIL, 1 BLOCKED** (10 retained TC attempts). No payment/order was submitted and no full DST campaign or Jenkins build was launched. These results do not close the missing formal definitions.

| ID | Latest result | Actual evidence |
| --- | --- | --- |
| SAM-24969 | BLOCKED | [1795613028772-23304](../test-results/dst-pilot/mx/1795613028772-23304/results.json) — PreQA2 redirected to WMC login; no renewal attempted. |
| SAM-24971 | PASS | [1795615001913-82292](../test-results/dst-pilot/mx/1795615001913-82292/results.json) |
| SAM-24972 | PASS | [1795613028772-23304](../test-results/dst-pilot/mx/1795613028772-23304/results.json) |
| SAM-24988 | PASS | [1795613028772-23304](../test-results/dst-pilot/mx/1795613028772-23304/results.json) |
| SAM-25064 | PASS | [1795614435978-103060](../test-results/dst-pilot/pe/1795614435978-103060/results.json) |
| SAM-25065 | PASS | [1795613883757-6360](../test-results/dst-pilot/pe/1795613883757-6360/results.json) |
| SAM-25081 | PASS | [1795613883757-6360](../test-results/dst-pilot/pe/1795613883757-6360/results.json) |

Initial failed attempts remain in the phase matrix: MX cart icon selector was corrected against its native accessible image; PE summary was first attempted as guest, then the registered prerequisite was established by live read-only comparison and the complete scenario passed. No failure was overwritten as a historical PASS. The final MX presentation rerun additionally proves the native product name for the exact SKU.

Validation commands: `npm run repo:refactor:gate` passed architecture, removed-consumer audit, generation audit, official scope (362), business steps, QST discovery for four markets, DST discovery, **1756 governance tests**, **4 Executive V2 tests**, **38 reporting tests**. `npm run dst:pilot:gate` passed **14 current focused tests** after final changes, including shared identity, native name/icon/footer, stage observations, financial guards, source hashing across CRLF/LF, selection, dormant-case accounting and artifact isolation. Existing BC reusable components passed **12 focused tests**. QST full live campaigns were not executed in this phase.

Revalidation still required: authenticated WMC/PreQA2 for SAM-24969 and approved formal preconditions/steps/expected results for all seven pilots. The MX lane was released by its existing keep-alive before the final presentation rerun; no active lease was bypassed.
