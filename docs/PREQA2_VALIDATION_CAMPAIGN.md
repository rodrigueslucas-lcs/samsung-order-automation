# PreQA2 SMB QST validation campaign

## Authority

PreQA2 is the official validation environment for the SMB scenarios assigned to this scope. When an official TC is fully executed here and its official Expected Result is observed, the result is **PASS**. S1/STG is not an additional gate for those scenarios.

A page opening is not a PASS. The official business behavior must be exercised and observed.

## Baseline

The repository baseline contains 144 official SMB QST IDs: MX 37, CL 38, CO 35 and PE 34. `test-mapping/preqa2-validation.json` is the execution ledger. It starts empty on purpose: discovery evidence is not silently converted into TC PASS evidence.

## Execution order

1. Finish safe MX Base Store validation while the authenticated WMC/CDP session is available.
2. Resolve MX registered scenarios after legitimate Samsung Account authentication when required.
3. Validate MX EPP only after a real EPP context is proven.
4. Bootstrap and validate CL, CO and PE through the same approved WMC -> QA/Preqa2 -> sites -> getcookies -> storefront architecture.
5. Keep destructive payment/order/profile/cron work behind the existing explicit guards and separate authorization.

A blocked TC must not stop independent TCs.

## MX first-pass queue

The current coverage map gives an evidence-driven queue rather than a generic crawl.

### Safe storefront / navigation

- `SAM-24964` GNB Menu: prove rendering plus navigation to the official BC destination.
- `SAM-24968` Facets/Filter: interact with a real facet/filter and prove the product/result state changes.
- `SAM-24969` Add product from BC Page: prove the BC-origin path rather than substituting a direct PDP route.
- `SAM-25001` Back to Top: prove the official cart positioning/behavior.
- `SAM-25016` Sticky checkout button on mobile: use a mobile viewport and prove sticky behavior on the required page(s).

### Existing Partial candidates to close with live proof

- `SAM-24963` My Account: execute the official menu/link behavior in a legitimate registered session, not just menu visibility.
- `SAM-24971` Cart page UI: close remaining source-supported UI assertions, including info-icon behavior if present in the official Expected Result.
- `SAM-24972` quantity increase/decrease/delete: execute the already prepared safe flow live.
- `SAM-24982` trade-up: complete the safe add/result/delete state required by the official behavior.
- `SAM-24989` checkout Order Summary: execute and close the remaining official assertions.
- `SAM-24994` new address: prove the official shipping/billing behavior without order submit.

### Registered / account-dependent

- `SAM-24986` cart value on logout requires the official account-switch behavior.
- `SAM-24991`, `SAM-24992`, `SAM-24993` require legitimate registered checkout/address state.
- `SAM-25010` Track Order requires suitable non-sensitive test data or an existing valid order reference.

WMC authentication is not Samsung Account authentication. Human MFA/CAPTCHA remains manual.

### Data/promotion dependent

- `SAM-24975` Rewards text across cart/checkout/payment.
- `SAM-24985` Extended Warranty.
- `SAM-25006` Rewards payment.

Discover live eligible data from the official environment or official TC data. Never invent eligibility.

### Payment/order scenarios

`SAM-25002` is already Full in the current MX mapping. Other payment/order cases remain guarded. Do not place a payment/order merely because PreQA2 is authoritative; destructive authorization is a separate safety requirement.

### EPP

`SAM-25020`, `SAM-25021`, `SAM-25022`, `SAM-25034`, `SAM-25044`, `SAM-25045`, `SAM-25046` remain EPP-context work. Base Store proof must not be reused as EPP PASS. Establish the real PreQA2 EPP route/session first.

## Cross-market reuse

The shared-core registry contains 12 architecture families spanning the SMB markets, including PDP add-to-cart, Cart UI, checkout button, Login Home, address flows, Back to Top and BackOffice. Reuse business components where runtime evidence shows the same behavior, but keep market/store URLs, data and deltas explicit.

CL and CO currently have only basic S1 storefront automation. PreQA2 validation should therefore prioritize live evidence first, then reuse shared components rather than cloning MX specs.

## Evidence contract

For every executed TC update the ledger result with:

- official ID and market;
- PASS / FAIL / BLOCKED / NOT_APPLICABLE;
- guest or registered context where relevant;
- sanitized runtime path only (no query string or fragment);
- concise observed evidence tied to the official Expected Result;
- automation status;
- blocker when blocked;
- timestamp when available.

PASS requires evidence. BLOCKED requires a concrete blocker. Never store cookies, tokens, credentials, authentication URLs, payment secrets or sensitive query data.

## Promotion rule

A TC can move to Full/PASS when all of the following are true:

1. the ID is official for that market;
2. the intended store/context is correct;
3. guest/registered path matches the TC;
4. the official Expected Result is fully exercised in PreQA2;
5. runtime evidence is recorded;
6. automation claims match what was actually executed.

Do not require an S1 rerun for scenarios whose official validation environment is PreQA2.
