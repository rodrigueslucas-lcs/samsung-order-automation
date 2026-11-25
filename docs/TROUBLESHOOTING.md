# Operator Troubleshooting Guide

Use this guide when the project does not behave as expected. Diagnose the cause before changing test assertions or selectors.

## 1. `auth:refresh` asks for credentials or fails before opening login

### Symptom

Messages such as:

```text
Samsung credentials were not found
```

### Meaning

The script is trying automatic credential mode and no approved local/env credential was found.

### Recommended onboarding fix

Use manual mode and sign in interactively:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
CL_QST_ENVIRONMENT=S2 CL_AUTH_MANUAL=1 npm run auth:refresh:cl
```

Do not put passwords into source files.

## 2. CAPTCHA or MFA appears

This is not an automation defect by itself.

Complete the challenge in the dedicated browser and wait for the flow to return to the storefront. The automation intentionally does not bypass identity verification.

If the command times out before the operator can finish, rerun refresh rather than editing test code.

## 3. Session file exists but tests say auth is expired

A saved session file is not proof that the server still accepts it.

Run the market refresh again:

```bash
<MARKET>_QST_ENVIRONMENT=S2 npm run auth:refresh:<market>
```

Use the market-specific prefix shown in the root README.

## 4. Jenkins fails during auth preflight before any TC

Classify this separately from a functional TC failure.

Check:

1. correct market/environment bundle was published;
2. Jenkins installed the expected credential;
3. the bundle was generated after the latest refresh;
4. network/VPN/staging host was reachable;
5. failure is auth validation vs simple navigation timeout.

Do not report an official TC as failed when execution never reached the tests.

## 5. `npm error Missing script`

First run:

```bash
npm run
```

Then compare with the root README. If a market lacks a command that the other markets expose, treat it as a standardization gap rather than inventing an undocumented one-off command.

## 6. `git pull --rebase` refuses because of local changes

Never discard work blindly.

Start with:

```bash
git status
git diff --stat
```

Commit intentional work or stash temporary work before pulling. If a conflict appears, resolve only after understanding both sides.

Do not use force push as a routine recovery mechanism.

## 7. One TC fails locally/Jenkins but passes in the other environment

Collect evidence before patching:

- exact SAM ID;
- market/environment;
- final URL;
- screenshot/trace;
- server/UI error message;
- whether auth/test data was valid;
- whether the same input passes locally.

A CI-only environment/access issue should not be 'fixed' by weakening assertions until the cause is understood.

## 8. Known product defect breaks a release campaign

If the behavior is already proven and a bug/RT will be tracked:

1. keep the TC represented in official scope;
2. capture the exact known failure signature;
3. link the SAM TC to the bug/RT in reporting metadata when available;
4. quarantine only that narrow known signature if the release-health policy permits it;
5. let unrelated failures continue to fail.

Never convert every error in the TC to PASS just because one known defect exists.

## 9. BackOffice login succeeds but a search/action says access denied

Separate authentication from authorization.

If Administration Cockpit login succeeded but an operation shows an explicit access-rights message, the user/session is authenticated but the requested BackOffice item/action may be restricted.

Capture the explicit message. Do not wait for a downstream locator timeout and call it a selector problem.

## 10. Test creates orders/payments

Confirm the intended environment and authorization flags before execution.

Never blindly rerun after an ambiguous submit. First inspect order/payment evidence to determine whether the backend action already happened.

Production remains read-only.

## 11. Full four-market execution

The current recommended operation is one market campaign at a time.

Reasons include:

- independent market auth state;
- temporary session lifetime;
- second-account dependencies in MX/CO;
- shared state/test-data side effects;
- payment/order scenarios;
- clearer release evidence and failure attribution.

A future orchestrator can run markets sequentially with auth preflight. Do not assume simultaneous four-market execution is the maturity target.

## 12. Where to investigate a failure

Recommended order:

```text
Executive Dashboard -> Allure business step -> screenshot/video -> Playwright trace -> code
```

The dashboard tells you the business/result category. Allure identifies the failing SAM/step. Trace is for the detailed browser timeline.

## 13. Before asking another developer for help

Provide:

```text
market
environment
SAM ID
local or Jenkins
exact command/job parameters
error text
screenshot/trace availability
git status if code was changed
```

This is enough to reproduce/diagnose most issues without guessing.

## 14. Base Store MX/CL build findings — 2026-11-19

- **MX SAM-25002 / SAM-25010:** the native card label is `Tarjeta de Débito/Crédito`.
  A selector accepting only the reversed wording entered the wallet fallback,
  initiated CheckoutPro and stopped at MercadoPago login. `MarketPaymentPage`
  now recognizes both native card labels and waits for the native accordion;
  choosing a card no longer initiates a wallet order. Preserve any earlier
  wallet initiation evidence and reconcile it before another financial attempt.
  The S2 Base Store credit-card scenarios explicitly choose the separate native
  `Tarjeta de Crédito` panel offered by the checkout. The debit/credit NoMSI
  method returned 601 without a confirmed order in controlled attempts; this is
  not a reason to silently switch methods after submission. The original MX
  test-card fixture remains unchanged. Older uncertain attempts were reconciled
  against BackOffice before the next controlled execution.
  A captured order code is not receipt-page proof: both S2 order creation paths
  now wait for that same order's confirmation URL, visible public number and
  success message before recording confirmation. They never navigate to a
  receipt as a fallback or repeat payment to satisfy this check.
  The native card-details response can contain historical saved-card order
  identifiers. S2 Base Store capture therefore accepts identity only from an
  individual `/v2/mx/users/.../orders/...` response, excluding card details and
  the order-history list. An identifier found in payment details must never be
  reported as the newly created order.
  Final targeted validation proved SAM-25002 with a new order and matching
  receipt UI, and SAM-25010 with a new guest order, OTP and tracking details.
  Earlier attempts and their raw failures remain historical evidence.
- **CL SAM-24811:** the checkout saved the QA address, proven by its address API.
  The first cards rendered before `Ver más`, so an immediate visibility check
  ended pagination early. The page object now waits for the requested address
  or pagination control and still requires the actual address to be visible.
- **CL SAM-24814:** use the existing checkout selector helper to wait for the
  visible, enabled dependent commune control after region selection.
- **CL SAM-24818:** its business step finished, but the context teardown hit
  the default 30-second evidence budget while finalizing video. CL Base Store
  official campaigns now retain a 120-second teardown budget, as CO already
  does. Scenario assertions and the other suites' defaults remain unchanged.
- **MX SAM-24963 automation correction:** build #20's guessed `/mx/mypage/`
  fallback received CMS HTTP 404. That observation did not establish an
  application defect for the My Account menu TC. Authenticated operator evidence
  and an independent browser replay showed that `/mx/mypage/profile-setting`
  renders the actual account navigation in `ul.lower-nav-links-mx`, while the
  compact avatar dropdown exposes identity/logout. S2 now proves authentication
  before and after entering profile settings, validates all six required account
  links and their expected MX paths in that navigation, and proves logout
  separately. Footer links cannot satisfy the assertions. The native Orders
  label is `Mis órdenes`. CMS links can carry Samsung Production/PreQA hosts;
  the menu TC inspects them without clicking or navigating outside staging.
  Unknown hosts or wrong paths still fail. The old CMS response and failed runs remain historical
  evidence; do not classify this TC as a known application defect from that
  fallback alone. S1 behavior is preserved pending independent runtime proof.
- **CL SAM-24830, build #15:** product navigation emitted thumbnail `onImageLoad`
  ZK updates before the actual Search `onClick` query. Waiting for the first AU
  response falsely marked the search ready; the SKU wait expired while the real
  query was still pending and `Processing...` remained visible. Product search
  now waits for the response containing the clicked button's ZK UUID, allowing
  a bounded 90-second query and requiring the exact SKU afterward. It submits
  Search once. Background image updates cannot satisfy this readiness check;
  HTTP failures and a completed query without the product still fail.

## 15. EPP CI stops before the official tests

An `INFRA_ERROR` with no Playwright results is not a product-test failure.
Read the current build's `[epp-ci] Preparation failed` stage/reason. Diagnostics
use allowlisted codes; exception text, stacks and credentials are suppressed.
Failed child-process startup is also reported instead of silently returning 1.

MX build #10 reproduced `EXECUTION / AUTH_BUSY`: scheduled EPP maintenance
already held the dedicated EPP identity. S2 CI now waits up to ten minutes for
normal lease acquisition before preflight or any test/payment. It does not
remove locks, stop the owner, start a competing login or replay a submission.
If the owner remains active at the deadline, the build still reports AUTH_BUSY.
Local callers retain their immediate BUSY behavior. Build #9 discarded the
original exception, so its exact historical cause cannot be asserted.

After preparation succeeds, `EPP_COMMERCE_RENDER_FAILED` requires separate
PDP evidence. A controlled MX reproduction showed the existing recovery
reload aborting the exact product GET before it finished. The storefront
observer now tracks only GETs for the configured S2 programme and SKU. It
allows up to 90 seconds for an already pending product read and then checks
hydration. It never reloads a still-pending request at that deadline; missing
content continues to fail. Existing access gates and the one bounded GET
recovery are preserved, and no cart/payment action is repeated. A failed
render attaches safe request counters instead of cookie or token contents.

### CL S2 Base Store: Delivery save before Payment

If SAM-24826 remains on `CHECKOUT_STEP_DELIVERY`, inspect the native delivery-save response before treating the URL timeout as a payment failure. CL build #16 clicked Continue less than one second after selecting shipping, while `POST /tokocommercewebservices/v2/cl/users/current/carts/current/deliverymodes/update` was still pending. The shared CL flow now waits for that exact successful response and its completed body before continuing, as the EPP flow already did. An HTTP failure stops the flow before payment. This does not replay delivery or payment submissions, change shipping selection, or alter S1 behavior.

A follow-up local run also exposed both receipt choices unchecked, with required company invoice fields visible. CL S2 Base Store now explicitly selects `Boleta`, checks that it stayed selected and waits for company invoice fields to disappear before Continue. Successful shipping persistence alone is not sufficient to claim the TC passed; validate the actual confirmation flow.

### EPP payment rendering failures are not prerequisite skips

`EPP_COMMERCE_NOT_RENDERED` at Payment means the configured checkout opened but its provider controls did not render within the bounded wait. This is an unexpected failure in every market, not a missing-mass skip. Inspect the native payment-mode request and the masked discovery screenshot; do not associate a card loading failure with the MX Cash defect RT-779284. No order is proven until its new causal confirmation is validated.

For MX S2 `pymesmx`, one native Payment reload is allowed before the financial adapter only when the exact current-cart `paymentmodes` GET failed without an HTTP response after at least 55 seconds. A short bounded settle permits the native one-minute request deadline to finish; an in-flight read is never canceled. HTTP errors, successful reads with missing UI, other programmes and other routes do not qualify. The reloaded page must render providers and retain independent identity proof before proceeding. This recovery never repeats a payment submission.

The replacement GET can start several seconds after reload bootstrap. If the
60-second provider UI wait ends while that GET is still pending, recovery allows
up to 15 more seconds for that same read and then up to 15 seconds for rendering.
There is no second reload. Persistent missing controls still fail before card
entry; a loading skeleton is never payment confirmation.

On November 24 at 20:04 UTC, an authenticated, read-only comparison reproduced
the native GET failing after 60.4 seconds with `net::ERR_FAILED` and browser
CORS/missing-allow-origin errors. A direct request to the same exact programme
URL returned HTTP 502 after 60.9 seconds. The affected route was
`/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes`.
Identity and programme access were accepted. No card or financial submit was
involved. This signature needs staging API/gateway investigation; it must not
be mapped to the Cash defect or hidden by disabling browser CORS protections.
Revalidate the actual Payment controls and a new causal card order after the
endpoint recovers. A successful read-only diagnostic is not a SAM-25045 PASS.

MX S2 now obtains its programme-bound order reader from the accepted current-cart response, so it records order history before every card submit. For a 601 response, only a new order absent from that baseline, with the same programme, SKU, quantity and creation window, followed by genuine confirmation UI, can satisfy the frontend contract. A 601 alone never passes the TC. Unconfirmed attempts remain guarded until read-only reconciliation proves either their causal order or the existing rejected-attempt archival contract.

The MX S2 `pymesmx` credit-card case selects the native Crédito panel, as the proven MX Base Store credit flow does. Its submit capture is restricted to the programme's `mx-mercadoCC` endpoint; the combined Débito/Crédito panel is not a fallback for this TC. Other markets and programme selections are preserved.

The native mode identifier has also been observed as `mx-mercadoCc`. Capture
accepts that casing only in the final two mode characters, retaining exact
programme and operation paths. The November 23 native-credit run displayed the
transaction-failure banner after one submit, without confirmation. Its response
body was missed by the earlier case-sensitive matcher: HTTP 200 alone does not
identify its business outcome. Do not infer 601, mark PASS, delete its marker,
or retry from that screenshot alone. On November 24, a separate operator-authorized
staging incident review combined that original failure capture with fresh accepted
primary identity/entitlement and every detail in the complete 18-order history.
No order had been created since the attempt. The original record was preserved
unchanged in a reviewed-no-order archive with hashed evidence and a separate
review; its financial outcome remains explicitly unconfirmed, and it is not a
rejected-payment or PASS record. This exceptional legacy review is not a runner
flag or an automatic expiry policy. This card failure is separate from the known
Cash defect RT-779284.

New MX S2 card attempts persist a captured 601 outcome before reconciliation.
If no new causal order can be confirmed, the adapter reads every history page
and checks each order's identity/creation time, then rereads the history head
and totals to detect an order arriving during that scan. Only complete, stable history
with no order since the attempt permits archival as rejected. The current TC
still fails and never submits twice. If a read is unavailable, the persisted
outcome stays guarded; the next run first performs the same authenticated,
read-only reconciliation before any cart change. Unknown responses, incomplete
history and any potentially new order remain blocked. Local and Jenkins runs
use the same programme-bound ledger. Interrupted archival resumes safely.

### Selected EPP tests must expose operational failures

For a controlled MX S2 `pymesmx` credit-card comparison, set
`MX_EPP_TEST_CARD_FILE` to an approved JSON fixture below the ignored
`playwright/.auth/epp/cards/` directory and run the normal `SAM-25045` command.
The fixture must identify `market`, `environment`, `program`, `provider`,
`type`, `scenario`, `brand` and a non-sensitive `id`, with its complete `card`
fields supplied locally. The accepted context is MX/S2/pymesmx/mercadopago,
credit/approved, with Mastercard, Visa or Amex. Other programmes/environments
are rejected; other markets keep their existing configuration. The default
card, contact and delivery fixtures are preserved. Reports attach only the
fixture ID, brand and execution scope, never card values.

Use the provider's current [Mexico test-card reference](https://www.mercadopago.com.mx/developers/es/docs/your-integrations/test/cards).
Do not commit card fixtures or infer expiry/security codes. Run brand variants
sequentially after any existing MX campaign releases its shared market lane.
Every variant is a separate normal execution with its own outcome; an uncertain
submission must be reconciled before trying the next card. Several declined
cards alone do not distinguish merchant configuration from an application defect.

The storefront and payment prerequisite helpers throw their concrete error code
instead of skipping a selected TC. Missing identity, entitlement, product/contact
data, submit authorization or reconciliation therefore produces a visible test
failure. This does not bypass the prerequisite, clear an uncertain attempt or
authorize a repeated payment. A previous unresolved submission fails with
`AMBIGUOUS_EPP_ORDER_ATTEMPT` before cart reset or another financial submit.

The exact EPP notification tutorial close uses a bounded ten-second native click
wait so first paint/entrance animation can finish. It still requires the tutorial
to disappear, never forces a click, and never accepts notification permission or
closes business/payment/CAPTCHA dialogs.

### MX S2 Base Store: account-menu animation and Payment readiness

The account menu can retain a visible closing Angular overlay while the active
menu is open. Authentication checks use the active, settled profile menu and
bounded hover attempts; an old closing Logout entry cannot authenticate an
otherwise signed-out page. S1 keeps its existing behavior. Targeted S2
`SAM-24963` passed after this correction on November 24, 2026.

The Payment heading alone does not prove that its provider controls or address
summary have rendered. The S2 Base Store transition now observes the exact
payment-method GET, preserves an in-flight read, and requires actual provider
controls before running the unchanged address/postcode/footer assertions.
One document GET recovery is permitted before financial submission, with no
replayed Delivery POST. Unauthorized reads and permanently empty UI still
fail. Targeted `SAM-24991` passed creation, edit and cleanup in the same run.
These targeted results do not replace the full Jenkins campaign result.

The PreQA Galaxy Z Fold6 catalog can contain the Navy `SM-F956BDBMLTM` while
the buying tool omits its native color control. Following operator approval,
`SAM-24969` now explicitly selects the separate catalog card for Crafted Black
512 GB, `SM-F956BAKMLTM`, which is also offered by the native buying tool.
This changes the test fixture; it does not establish that the missing Navy
control has been repaired.

An already selected variant is accepted only when the checked native device,
checked storage and visible Add action all carry that exact configured SKU.
Otherwise the helper requires its native color control, with one bounded
document GET recovery before service choices or Add. An unavailable or
mismatched model still fails as `MX_BC_VARIANT_CONTROL_UNAVAILABLE`.
The official TC retains its intended-SKU, successful native Add, exact quantity
increase and persistence-after-reload assertions. WMC authentication alone
does not establish that a product is selectable or was added successfully.
