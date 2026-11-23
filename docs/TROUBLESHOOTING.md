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
