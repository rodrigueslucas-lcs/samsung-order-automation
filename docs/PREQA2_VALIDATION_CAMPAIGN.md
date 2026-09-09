# PreQA2 SMB QST validation campaign

## Authority

PreQA2 is the official validation environment for the SMB scenarios assigned to this scope. When an official TC is fully executed here and its official Expected Result is observed, the result is **PASS**. S1/STG is not an additional gate for those scenarios.

A page opening is not a PASS. The official business behavior must be exercised and observed.

## Baseline

The repository baseline contains 144 official SMB QST IDs: MX 37, CL 38, CO 35 and PE 34. `test-mapping/preqa2-validation.json` is the execution ledger. Discovery evidence is never silently converted into TC PASS evidence.

The ledger is expected to grow continuously. Unit tests therefore validate its schema, official IDs, evidence integrity and counts rather than freezing the number of executions at zero.

## Operating commands

Use the control-plane commands after the branch containing them has been integrated locally:

```bash
npm run preqa2:plan:mx
npm run preqa2:closure:mx
npm run preqa2:gate
npm run reporting:preqa2:status
npm run reporting:preqa2
```

`preqa2:plan:mx` prints the pending official queue together with safe/guarded classification and verified guest/registered/EPP prerequisites. `preqa2:closure:mx` answers the key question: which official TCs are still not accounted for? `preqa2:gate` validates the official registry, mapping architecture, execution ledger and reporting contracts.

For an explicit strict check after a live campaign:

```bash
PREQA2_REQUIRE_SAFE_EXHAUSTED="MX" node scripts/preqa2-gate.cjs
```

The strict check fails while any MX TC that is classified as a safe candidate remains `NOT_RUN`. A FAIL is still an executed result; the gate does not turn failures into PASS.

## Execution order

1. Finish safe MX Base Store validation while the authenticated WMC/CDP session is available.
2. Resolve MX registered scenarios after legitimate Samsung Account authentication when required.
3. Validate MX EPP only after a real EPP context is proven.
4. Bootstrap and validate PE, CL and CO through the same approved WMC -> QA/Preqa2 -> sites -> getcookies -> storefront architecture.
5. Keep destructive payment/order/profile/cron work behind the existing explicit guards and separate authorization.

A blocked TC must not stop independent TCs. Likewise, one failed TC does not end the campaign.

## Authentication is a test precondition, not a shortcut

WMC authentication only grants access to PreQA2. It is not Samsung Account authentication.

The campaign model explicitly marks known official customer-account scenarios as `registered`. MX examples include `SAM-24962`, `SAM-24963`, `SAM-24986`, `SAM-24991`, `SAM-24992`, `SAM-24993`, `SAM-25002` and EPP `SAM-25045`. Known guest cases such as `SAM-24975` and `SAM-24995` are also marked explicitly. Unknown cases remain `unknown` rather than being guessed.

If Samsung Account login reaches human MFA/CAPTCHA/phone approval, the automation may bring the real screen forward and wait. It must not bypass the human step.

## MX first-pass queue

The current coverage map gives an evidence-driven queue rather than a generic crawl.

### Safe storefront / navigation

- `SAM-24964` GNB Menu: prove rendering plus navigation to the official BC destination.
- `SAM-24968` Facets/Filter: interact with a real facet/filter and prove the product/result state changes.
- `SAM-24969` Add product from BC Page: prove the BC-origin path rather than substituting a direct PDP route.
- `SAM-25001` Back to Top: build the safe cart prerequisite and prove the official positioning/behavior.
- `SAM-25016` Sticky checkout button on mobile: use a mobile viewport, real cart/checkout state and scrolling to prove sticky behavior.

### Existing Partial candidates to close with live proof

- `SAM-24963` My Account: authenticate as a real Samsung Account customer, open My Account and execute every link required by the official TC; menu visibility alone is insufficient.
- `SAM-24971` Cart page UI: close remaining source-supported UI assertions, including info-icon behavior if present in the official Expected Result.
- `SAM-24972` quantity increase/decrease/delete: execute the prepared safe state-changing cart flow live.
- `SAM-24982` trade-up: complete the safe add/result/delete state required by the official behavior.
- `SAM-24989` checkout Order Summary: execute and close the remaining official assertions.
- `SAM-24994` new address: prove the official shipping/billing behavior without order submit.

### Registered / account-dependent

- `SAM-24962` requires legitimate Samsung Account login on the PreQA2 storefront.
- `SAM-24963` requires the actual My Account experience after that login.
- `SAM-24986` cart value on logout requires the official account/logout behavior.
- `SAM-24991`, `SAM-24992`, `SAM-24993` require legitimate registered checkout/address state.
- `SAM-25010` Track Order requires suitable non-sensitive test data or an existing valid order reference.

Do not label those cases blocked simply because customer authentication is needed. Attempt the real flow and stop only when a human-only authentication action is actually visible.

### Data/promotion dependent

- `SAM-24975` Rewards text across cart/checkout/payment.
- `SAM-24985` Extended Warranty.
- `SAM-25006` Rewards payment.

Discover live eligible data from the official environment or official TC data. Never invent eligibility, but also do not stop at the first ineligible SKU when the official Test Data indicates a valid category/product can be used.

### Payment/order scenarios

Payment/order scenarios remain guarded. PreQA2 being the authoritative validation environment does not authorize a destructive action. Payment submit/order placement still requires its explicit runtime guard and separate authorization.

Safe payment-mode/form inspection may continue without submission when that satisfies only a prerequisite or a non-destructive part of a larger TC; it must not be reported as a full PASS when the official Expected Result requires successful payment/order creation.

### EPP

`SAM-25020`, `SAM-25021`, `SAM-25022`, `SAM-25034`, `SAM-25044`, `SAM-25045`, `SAM-25046` are EPP-context work in the current MX mapping. Base Store proof must not be reused as EPP PASS. Establish the real PreQA2 EPP route/session first.

## Cross-market reuse

The shared-core registry contains 12 architecture families spanning the SMB markets, including PDP add-to-cart, Cart UI, checkout button, Login Home, address flows, Back to Top and BackOffice. Reuse business components where runtime evidence shows the same behavior, but keep market/store URLs, data and deltas explicit.

CL and CO currently lack complete case-level official metadata in the repository. Shared-family membership may be used as architecture guidance, but store, Expected Result, account context and market-specific data remain unknown until the official source or live evidence proves them. The campaign therefore exposes `needs-official-review` rather than inventing metadata.

## Evidence contract

For every executed TC update the ledger result with:

- official ID and market;
- PASS / FAIL / BLOCKED / NOT_APPLICABLE;
- guest or registered context where relevant;
- sanitized runtime path only (no query string or fragment);
- concise observed evidence tied to the official Expected Result;
- automation status;
- blocker when blocked;
- ISO validation timestamp.

PASS, FAIL and NOT_APPLICABLE require an evidence summary. BLOCKED requires a concrete blocker. Never store cookies, tokens, credentials, authentication URLs, payment secrets or sensitive query data.

The canonical recorder fails closed if a different official result already exists for the same market/ID. Replacing a recorded result must be explicit so a later run cannot silently overwrite prior evidence.

## Ledger integration

Parallel live work may generate a ledger while the remote architecture branch also changes the ledger schema/control plane. Do not resolve that by blindly choosing `ours` or `theirs`.

`utils/preqa2LedgerMerge.js` provides a conflict-safe merge for canonical ledgers. Independent results are unioned. Different results for the same market/ID are treated as conflicts by default and require evidence review. `prefer-newer` is available only when both records contain unambiguous timestamps; explicit base/incoming preference also exists for a deliberate decision.

The merge CLI writes to a new file instead of overwriting the source:

```bash
node scripts/merge-preqa2-ledgers.cjs base.json incoming.json merged.json
```

Review `changed` IDs before choosing any non-default merge strategy.

## Official PASS versus automation coverage

Official validation result and persisted automation coverage are separate dimensions.

If the official TC is executed correctly in PreQA2 and its Expected Result is met, its official result is **PASS**. That result does not need an S1 rerun.

Automation coverage should only be promoted when the persisted automation itself is also proven. A manually/live-proven PASS may therefore coexist with an automation gap. This distinction prevents the dashboard from reporting more automated coverage than actually exists while preserving the official PASS.

## Closure rule

A market is not considered safely exhausted while any safe official TC remains `NOT_RUN`.

The closure report separates:

- safe `NOT_RUN` work that should still be executed;
- guarded/destructive review;
- missing official metadata review;
- PASS;
- FAIL;
- BLOCKED;
- NOT_APPLICABLE.

The target is not artificial 100% PASS. The target is **100% accountability**: every official TC either has a real result or a concrete unresolved reason, with all safe executable work exhausted before the campaign stops.
