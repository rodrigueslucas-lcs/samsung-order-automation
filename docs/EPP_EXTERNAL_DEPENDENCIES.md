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
represented: 18 safe-flow implementations, one MX S2 card adapter with causal
runtime proof, and seven executable payment/confirmation prerequisite inspections.
The seven inspections are not implemented payments and cannot pass from discovery alone. The operator corrected the filter/add scope to PDP. Variant assertions require
changed SKU and selected control; MX/CO Add uses the exact eligible PDP variant,
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

## Latest discovery: 2026-10-27 (supersedes historical findings below)

Safe implementations remain MX 5, CO 5, PE 4 and CL 4. Operator scope
correction: SAM-25020 and SAM-24929 validate PDP variants/selectors;
SAM-25021 and SAM-24930 add from PDP and do not require an artificial PLP.

Real official PASS evidence: MX S2 SAM-25020, SAM-25021, SAM-25022,
SAM-25034, SAM-25044, SAM-25045; CL S1 SAM-24836, SAM-24840 and SAM-24851. Auth probes alone are not TC PASS.
The new MX variants assertion proves a different SKU and active variant.
Add-to-cart proves an exact-SKU successful response and controlled EPP cart.

MX S2 now reaches Payment through EPP-scoped reuse of CartPage and
MxCheckoutPage. Only explicit EPP opt-in changes site/path binding; Base Store
defaults remain intact. Delivery is committed once with checkout/update ACK,
then a Payment route and real provider controls are required. Restored postcode
forms require a fresh lookup and colonia selection, not cached region alone.
Providers observed: Mercado Pago credit/debit, wallets and cash. Secure card
fields use secure-fields.mercadopago.com, as in the existing MX helper.
Seven remaining payment/confirmation cases inspect real prerequisites; their
source implementation is PREREQUISITE_FLOW, not an implemented payment. MX S2 has an opt-in card
adapter reusing PaymentPage and a persistent ambiguity marker before submit.
Only a new causal order plus visible confirmation can archive that marker.
Never replay a submit after timeout.

Remaining access/data dependencies:

| Market | Env | Current dependency | Impact |
|---|---|---|---|
| MX | S1 | Authenticated/entitled native proof exists; later fresh context returned to auth/multistore. No candidate PDP eligibility proven. | AUTH_OR_ENTITLEMENT_REQUIRED; MISSING_OR_UNPROVEN_EPP_PRODUCT |
| CO | S1 | Earlier Account security denial and blocked callback; automatic approval rejected another authentication attempt. No repeat/indirect login attempted. | Provider/operator clearance; AUTH_OR_ENTITLEMENT_REQUIRED |
| CO | S2 | Corporate registration gate; previously observed verification-success redirect to Production remains unresolved. No corporate activation replay. | CORPORATE_ACTIVATION_REQUIRED; ENVIRONMENT_DEFECT |
| PE | S1 | Callback leaves staging for Production registration; guard prevents continuation. | ENVIRONMENT_DEFECT |
| PE | S2 | Supplied code rejected previously. No repeated submission this round. | VERIFICATION_CODE_REJECTED; valid programme access data required |
| CL | S1 | Independent EPP READY and eligible SM-S918BZKILTL PDP proven; SAM-24836/24840/24851 PASS. Footer is empty in cart; local contact/delivery fixture absent. | SAM-24841 FAIL (footer); MISSING_EPP_CONTACT_DATA for payment |
| CL | S2 | checkAccess=true with anonymous user; homepage and explicit auth route lack functional registered entry. | AUTH_OR_ENTITLEMENT_REQUIRED; EPP_COMMERCE_NOT_RENDERED |

Observed defects (no invented Jira):

* MX S1 / CL S1: open entitled EPP home, use header Search and submit Galaxy.
  Expected: programme staging search. Actual: link leaves for samsung.com
  Production search; blocked before contacting Production. CL sanitized path:
  /cl/multistore/alianzas/search/. Catalogue discovery cannot safely continue
  through these links. Evidence: epp-final-mx-s1-search.log and
  epp-final-cl-s1-search.log in local ignored discovery output.
* PE S1: finish Account challenge and callback. Expected: staging EPP return;
  actual: Production programme registration target. No Production form submitted.
* CO S2: corporate verification-success staging route was previously observed
  redirecting to Production /shop/. Current public root still renders the
  corporate registration gate; internal redirect configuration cause unproven.
* CL S2: open programme home/auth entry after bootstrap. Expected: a usable
  registered entry or positive registered identity; actual: anonymous + access
  flag and no functioning profile/login control. Access flag is insufficient.

Evidence is isolated under test-results/epp/<market>/<env>/<run>/ and local
ignored discovery logs. The generated 52-row matrix records implementation,
actual runtime and current blockers separately. Historical PASS is preserved
against prerequisite blocks; contradictory functional failure still fails.


### Causal MX S2 card order and confirmation

One authorized Mercado Pago card submit created public order **MX261026-78768209**.
The exact internal order-detail GET returned HTTP 200 with that public number
and SHIPPING_REQUESTED. Confirmation of the same attempt passed SAM-25045 in
the official runner; no second submit was performed during recovery.
The internal identifier has a timestamp suffix; UI displays the public number.
The deployed component reads a matrix parameter (orderConfirmation;orderCode=...),
not an orderCode query parameter. The initial recovery query route incorrectly
requested orders/null. That automation error was corrected, not labelled an app bug.
The duplicate guard records SUBMITTING before the click, preserves an observed
internal ID, and archives only after exact order GET plus causal URL/UI proof.
History/order-list/analytics responses cannot provide order identity.

A proven notification tutorial could block profile actions. EPP now closes only
#ins-web-opt-in-reminder-container .ins-web-opt-in-reminder-close-button.
It never accepts notification permission or closes CAPTCHA/business dialogs.
Native MX S2 refresh and independent verify returned READY and closed the owned
browser after this fix; the late-overlay DOM regression also passed.

A new card case requires an authenticated EPP session, approved payment.card
in the ignored EPP runtime-data.json and explicit ALLOW_PAYMENT_SUBMIT=1:

```sh
MX_QST_ENVIRONMENT=S2 MX_QST_TARGET_IDS=SAM-25045 ALLOW_PAYMENT_SUBMIT=1 npm run qst:mx:epp
```

For an observed unresolved attempt only, reconciliation is read-only:

```sh
MX_QST_ENVIRONMENT=S2 MX_QST_TARGET_IDS=SAM-25045 EPP_RESUME_PENDING_ORDER=1 npm run qst:mx:epp
```

Without a pending marker, recovery cannot reset a cart or create another order.
An unknown/ambiguous submit blocks fresh financial work until reconciled.
Do not delete its marker to bypass the guard. Card saving is explicitly disabled
before fixture entry; failure to disable it prevents submit.


### Final validation and remaining limits

Matrix: 26 official IDs, 52 market/environment rows; **9 proven PASS, 42 BLOCKED,
1 FAIL and 0 NOT_RUN** after current MX cash, CO card and CL S1 revalidation.
Source inventory: 18 safe implementations + 1 MX card implementation +
7 executable prerequisite inspections. Authentication discovery is supporting
evidence and never adds a TC PASS.

| Market | Safe implementations | Real S1 PASS | Real S2 PASS | Payment/confirmation |
|---|---:|---|---|---|
| MX | 5 | none | 25020, 25021, 25022, 25034, 25044, 25045 | one causal Mercado Pago card order and confirmation |
| CO | 5 | none | none | 24953 blocked by access/entitlement |
| PE | 4 | none | none | 25138/25140 blocked by callback/access/code prerequisites |
| CL | 4 | 24836, 24840, 24851 | none | CL S1 payment reaches Contact and lacks approved contact/delivery mass; CL S2 access still blocked |

Cash SAM-25046: real discovery identified mx-mercadoCash, four bank/store options, an enabled Ir a Mercado Pago button and a configured provider test buyer. The programme-bound details request returned HTTP 200. Base Store MX implements selection/readiness for Pay in Cash; no completed cash/voucher flow was found to reuse. The EPP prerequisite inspector now expands the exact outer and inner cash panels, checks the current API contract and reports only safe booleans/counts. Checkout Pro test access, voucher and return/confirmation remain unproven; ignored EPP runtime data contains a card fixture but no cash-gateway access fixture. PAYMENT_FLOW_NOT_PROVEN is specific to EXTERNAL_GATEWAY, not a generic placeholder or a newly asserted app defect. No cash submit/order has been performed.

Focused final release validation: **166/166 EPP and affected MX tests passed**; the last CL/runner/contact changes also passed their isolated 35/35 regression; 32/32
Windows launcher/refresh tests passed in the isolated sequential recheck;
Executive reporting 4/4 and MX reporting 33/33 passed. Architecture, official
scope and business-step gates passed, and all eight EPP market/environment lists
remained valid. The broad refactor composite was executed but was not green:
915/919 passed and four Windows subprocess fixtures timed out. Their isolated
32/32 rerun passed; do not describe the original composite as successful.

The programme is still not fully homologated across S1/S2: external access,
entitlement and eligible catalogue dependencies above remain. No Base Store
state, keep-alive task, Jenkins credential or PreQA resource was modified by the
EPP implementation. Only the existing CO S2 SECOND window's QR option was opened
when the operator mistook it for an EPP FIRST email screen; no FIRST credentials
were entered there.

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

### Revalidation after regional FIRST/SECOND renewal

Regional Base Store READY is not EPP proof. Independent EPP readback first returned HTTP 400 UnknownIdentifierError with users/current anonymous and checkAccess=true. After renewing only EPP MX S2, the same exact internal order GET returned 200 and public code MX261026-78768209, status SHIPPING_REQUESTED. The matrix route and visible public number were revalidated with zero new submits. Evidence: local ignored epp-existing-order-revalidated.log and epp-existing-order-confirmed.png. The earlier orders/null was an automation query-vs-matrix parameter error, not a reproduced application defect.

CO S2 was rechecked at the corporate registration route and still requires corporate activation; no activation link was replayed. PE S1 and S2 were observed anonymous at the programme auth gate; the rejected PE S2 code was not resubmitted. A new PE S1 legitimate Account login was completed by the operator; the callback again attempted www.samsung.com/pe/multistore/beneficios_empleados/ and was blocked before Production continuation. CL S1 was independently renewed READY again, preserving SAM-24836 PASS. CL S2 root and explicit auth route were rechecked: access flag true, user anonymous, no usable login/profile entry or code field. CO S1 is read-only revalidation only; another credential retry remains prohibited after the security denial.

### Newly unlocked CL S1 commerce and remaining UI failure

After independent FIRST renewal, /cl/multistore/alianzas/alianzas/p/SM-S918BZKILTL rendered the exact SKU, variants and buy action with users/current and checkAccess both accepted. Its proven product mass is stored only in ignored runtime-data.json under S1.CL.product. The canonical EPP runner loads optional product.sku/product.pdpUrl into validated same-programme overrides; explicit operator overrides win and --list does not read private data.

SAM-24840 Add to Cart and SAM-24851 Checkout button now have real PASS. A CL title mismatch (carro, template whitespace) and use of guest instead of authenticated checkout were automation errors and are corrected. PE EPP checkout uses the same registered transition; Base Store defaults are unchanged.

**Observed CL S1 cart footer issue, SAM-24841:** open the proven PDP, add to cart, inspect /cl/multistore/alianzas/alianzas/cart. Product image/name/SKU/price, summary and Continue are present. The contentinfo element is empty, with none of Shop/Tienda, Account/Cuenta or Soporte/Support required by the current cart-UI assertion. Final rerun fails specifically on the absent footer heading, not cart text or an invented environment timeout. Evidence: epp-current-cl-s1-cart-final.log, its ignored Playwright trace/screenshots and epp-current-cl-s1-cart-structure.log (footer empty). CMS/footer expectations need functional confirmation; no Jira ID is invented and the assertion is not quarantined or weakened.

SAM-24864 reached registered Contact and reports MISSING_EPP_CONTACT_DATA. No CL payment or confirmation order is claimed. CO S2 SAM-24953 was executed again and remains CORPORATE_ACTIVATION_REQUIRED. MX S2 SAM-25046 was executed again and reports PAYMENT_FLOW_NOT_PROVEN: EXTERNAL_GATEWAY after mx-mercadoCash details and configured test-buyer proof; no cash order was submitted. Only one EPP financial order was created in this round: MX261026-78768209.
