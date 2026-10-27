# EPP External Dependencies

Only dependencies that cannot be resolved from the repository are listed here.

## Official QST multi-market access (2026-10-26)

The supplied staging URLs are centralized in `config/markets/epp.js` for MX, CO,
PE and CL in S1/S2. URL availability does not prove EPP identity or entitlement.
The historical DST dependency table below is not a current QST runtime result.

Use `npm run qst:<market>:epp:list` (lowercase market) for non-destructive discovery.
Use `<MARKET>_QST_ENVIRONMENT=S1|S2` and `<MARKET>_QST_TARGET_IDS=SAM-...` for
explicit selection; S2 is the default. `node scripts/discover-epp-access.cjs`
observes all eight access routes without submitting login, codes, carts or orders.
Its ignored output contains classifications, timestamps and HTTP status only.

The EPP runner uses an independent Playwright configuration and EPP-only verified
state (or an empty context when none exists). Only the operator-authorized FIRST
credential is reused; Base Store profiles, cookies, storage and bundles are never imported. Results
are isolated under `test-results/epp/<market>/<environment>/<run>/`.
Allure follows the existing opt-in `ENABLE_ALLURE=1` and installation command
`npm run reporting:allure:install`. Access tracing/video/screenshots are disabled
until an untraced access fixture and safe business-only evidence are implemented;
access codes must not appear in recordings or action logs. Business cart screenshots
are attached to the isolated report with input values masked; shared Page Objects
never write EPP evidence into their legacy global screenshot directory.

Current implementation is **not fully homologated**. All 26 official IDs are
represented: 18 safe-flow implementations and 8 explicit payment/confirmation
prerequisite placeholders. The latter are **not implemented payments** and must
not be advertised as executable order coverage. Filter assertions require changed
product results, MX/CO Add follows the configured PLP into the exact SKU variant,
checkout rejects login/Account as completion, contact proves delivery transition,
and Back to Top checks the official tooltip stacking requirement. DOM fixture
tests prove assertion behavior, not live market compatibility.
List/unit/gate success is not storefront PASS. Corporate activation for CO S2
requires an approved EPP identity and activation link; Base Store authentication
must never be treated as proof of EPP entitlement.

### Operator commands and data

```text
npm run auth:refresh:epp -- MX S2
npm run auth:verify:epp -- MX S2
npm run qst:mx:epp:list
npm run qst:mx:epp
npm run qst:epp:report
```

The same QST commands exist for `co`, `pe`, and `cl`. Refresh/verify accept any
of `MX/CO/PE/CL` and `S1/S2`; FIRST only, no SECOND alias. Refresh opens a dedicated
maximized Chrome, automatically fills email/password and submits each step once;
CAPTCHA/MFA remains manual. A fresh login cannot inherit an old email checkpoint.
Successful independent user/entitlement/logout verification exports renewed state
and closes the owned native window. Failed/human flows preserve their window.

`<MARKET>_QST_ENVIRONMENT` selects S1/S2. `<MARKET>_QST_TARGET_IDS` selects SAMs.
`<MARKET>_EPP_QST_PDP_URL`, `<MARKET>_EPP_QST_SKU` and
`<MARKET>_EPP_QST_PLP_URL` must identify eligible data in the same EPP programme;
Base Store and foreign-environment URLs are rejected. Contact data is read only
from ignored `playwright/.auth/epp/runtime-data.json`, keyed as
`S1|S2 -> MX|CO|PE|CL -> contact`. Required contact fields are `firstName`,
`lastName`, `phone`; CO also needs `email`, `documentType`, `documentNumber`.
No personal data or card data belongs in source control.

The runner holds a separate EPP market/environment lease through worker completion.
Direct Playwright execution uses the same lease fixture; discovery acquires none.
Verified business responses can preserve rotated EPP state between cases, without
ever exporting anonymous/rejected sessions. API proof is bound to the selected
environment and EPP site. No EPP session is published to existing Jenkins bundles.
Server-proof response bodies have a 15-second read deadline. An unfinished body
is classified as unavailable proof, never as expired authentication; it cannot
hold fixture teardown indefinitely.

### Runtime findings (2026-10-26)

| Market / environment | Proven outcome | Remaining prerequisite |
|---|---|---|
| MX S1 | Independent EPP FIRST authentication, entitlement and logout verified; owned browser closed | Eligible PLP/PDP data for this programme |
| MX S2 | Independent EPP FIRST verified; **SAM-25022, SAM-25044 and SAM-25034 live PASS** | Eligible PLP/filter data and proven EPP order/payment contract |
| CO S1 | Email/password automatic after stale-handoff fix; callback did not establish EPP acceptance | Successful provider callback and EPP entitlement |
| CO S2 | Cookie bootstrap and verification-success route inspected; client attempted Production `/shop/` after double-slash programme route | Correct staging activation return; Production was blocked |
| PE S1 | Email, CAPTCHA continuation and password submit observed; no accepted storefront return | Successful callback/entitlement |
| PE S2 | Email/password automatic; visible invalid-verification-code error after the configured code | Current programme code/entitlement data; no repeated submit |
| CL S1 | Returned to code gate; no completed entitlement proof | Accepted code/registration completion |
| CL S2 | Home shell loads; server checkAccess true but users/current anonymous and no profile/login control rendered | Registered login entry and functional homepage/catalog |

No EPP order/payment was submitted. Existing cart entries were preserved. Do not
classify generic timeouts as environment defects. PE code rejection is a data
blocker; the CO S2 staging-to-Production deviation is an observed defect with its
internal configuration cause still unisolated. Neither has an invented Jira ID.

### Continuation evidence (2026-10-27)

The published implementation was continued after `git pull --ff-only` confirmed
`010eb6d`, `e56ebde` and `eb2d239`. Scope remains 26 IDs: MX 5/7, CO 5/6,
PE 4/6 and CL 4/7 implemented safe cases; the other eight remain explicit
payment prerequisites, not executable payment coverage.

* **MX S2 SAM-25034 PASS:** the EPP contact test incorrectly called the guest
  checkout transition although the registered contact page had already opened.
  MX/CO EPP contact cases now use the existing authenticated transition. The MX
  rerun proved contact completion through delivery. Its synthetic QA contact
  fixture is stored only in ignored `playwright/.auth/epp/runtime-data.json`.
* **MX S2 SAM-25020 / SAM-25021 BLOCKED:** executed individually; no eligible
  EPP PLP was proven (`MISSING_OR_UNPROVEN_EPP_PLP`). Registered programme search
  returned HTTP 200 with zero products/facets, including the observed locale.
  The supplied PDP remained purchasable; that does not prove a PLP/filter flow.
* **MX S1:** historical authentication/entitlement/logout proof is preserved.
  This continuation found GNB catalogue links pointing to Production and did
  not follow them. No eligible S1 PLP/PDP was proven. A fresh independent
  verification did not complete; later programme identity was not accepted.
  This is not evidence of a new application defect or an expired-session diagnosis.
* **CO S1:** Samsung Account returned `/iam/blocked` with a visible security
  denial (`SAMSUNG_ACCOUNT_SECURITY_BLOCKED`). No repeated login was attempted.
  Provider/operator clearance and successful callback/entitlement are required.
* **CO S2:** public staging still reaches the corporate registration gate.
  The previously observed staging-to-Production deviation remains unresolved.
  No activation link was replayed and no Jira ID is invented.
* **PE S1:** the OAuth return target identified staging API `/pe/login/return`,
  but the resulting window reached the Production programme registration.
  No Production form was submitted. The internal configuration cause remains
  unisolated; staging callback/registration return configuration needs review.
* **PE S2:** `VERIFICATION_CODE_REJECTED` remains a data/access blocker. The
  rejected code was not submitted again. A valid programme code is required.
* **CL S1:** the native EPP window showed access and authenticated logout, but
  fresh independent verification did not complete. Login/entitlement remains
  unhomologated for this continuation; no native-only success is counted as PASS.
* **CL S2:** the public homepage rendered without a functional login/profile
  entry. The previous `checkAccess=true` plus anonymous identity remains
  insufficient. Functional registered entry and eligible catalogue are required.

The EPP-only Chromium guard now checks document navigation and commerce writes
with CDP Fetch interception, including server redirect hops. A real local
Chromium test proves allowed staging redirects/cookies and denial of a later
Production redirect. No callback is rewritten, credential request proxied or
Production fallback enabled. Security-denied Account pages and blocked redirects
stop EPP continuation without a repeated credential submit. Independent verifier
cleanup releases its observers/interceptor on failure as well as success.

Historical PASS cannot be erased by a newer prerequisite block; the matrix keeps
the current blocked attempt separately. A contradictory functional FAIL still
replaces PASS. Current matrix: **3 PASS, 49 BLOCKED, 0 FAIL** across 52 rows.
Authentication probes are supporting evidence, not official TC PASS.

For MX SAM-25045/25046, CO SAM-24953, PE SAM-25138/25140 and CL
SAM-24864/24865/24866, a correct programme identity, eligible SKU, checkout,
provider, approved staging payment fixture, duplicate-prevention contract and
expected confirmation must all be proven. MX has safe delivery evidence, but
its EPP payment provider/fixture/confirmation contract is still unproven. Other
markets are additionally blocked by the access/catalogue findings above.
No EPP order or payment was submitted in this continuation.

`npm run qst:epp:report` writes the required 52-row table (26 IDs × S1/S2) to
ignored `test-results/epp/homologation/matrix.md` and `matrix.json`, using actual
Playwright outcomes. The matrix separates implementation, prerequisite checks,
functional runtime, PASS, FAIL, BLOCKED and NOT_RUN, and omits raw error bodies.

## Historical DST dependencies (not the current QST result)

| Dependency | Why it blocks automation | Exact information/access required | Related TCs | Priority | Current evidence | Status |
|---|---|---|---|---|---|---|
| Peru EPP staging entry and store identifiers | No EPP page can be opened safely, so DOM/API compatibility cannot be tested | Exact non-Production URL, program variant, Site UID and Base Store UID | QST EPP 01-22; DST EPP TC01-TC59 | P0 | Known ST2 employee paths attempt to leave staging for Production | Open |
| EPP entitlement/bootstrap | Base Store authentication does not expose EPP and eligibility cannot be inferred | QA EPP account plus documented entitlement assignment; identify SSO, employee domain/ID, campaign, special cookie or VPN requirement if applicable | QST EPP 01-17; DST EPP TC01-TC46, TC59 | P0 | Current Samsung Account is valid only for Base Store; no EPP entry appears | Open |
| Stable EPP product mass | Product, cart, service and checkout behavior cannot be validated without eligible catalog items | Current EPP smoke SKU, CE SKU, IM SKU, Trade-In SKU, SC+ SKU and one SKU eligible for both services | QST EPP 02-14,16; DST EPP TC11-TC45, TC59 | P0 | Base Store SKUs are not evidence of EPP eligibility | Open |
| EPP payment configuration | A safe order cannot be created without knowing supported staging providers | Current EPP payment-mode codes, limits/test data and recommended smoke provider | QST EPP 13-17; DST EPP TC38-TC46, TC58-TC59 | P1 | Base Store modes differ over time and Pago Efectivo previously returned a functional error for registered Base Store | Open |
| EPP QA inbox/template | Email and email-login scenarios require a causal EPP order and correlatable recipient | Approved synthetic/shared QA inbox and current EPP acknowledgment/payment templates/CTA behavior | QST EPP 17; DST EPP TC02, TC46 | P1 | Mailinator helper exists, but no EPP email has been observed | Open |
| EPP BackOffice mapping | Existing S1/S2/S3 access cannot be assumed to contain EPP orders | Exact environment/URL, order discriminator/type and runtime CS/Admin authorities | QST EPP 18-22; DST EPP TC47-TC57 | P1 | No EPP order or BackOffice mapping exists in repo evidence | Open |
| Safe EPP cancellation and fulfillment mass | Cancellation/CronJobs are state-changing and require causal, disposable staging data | Disposable cancelable order; Waiting for Send Financial and Order Split orders; expected transition ownership | QST EPP 20-22; DST EPP TC50, TC53-TC57 | P2 | Existing S1 Base Store scan found only COMPLETED orders; not evidence for EPP | Open |
| EPP job codes | Running Base Store Peru jobs against an unknown EPP flow is unsafe | Exact EPP financial-initial and warehouse-transfer CronJob codes/prefixes | QST EPP 20-21; DST EPP TC54, TC56 | P2 | Existing `pe-toko*` jobs are proven for other staging flows only | Open |
