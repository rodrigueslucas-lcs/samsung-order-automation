# PE S1 Base Store — build #131 follow-up

## BackOffice

Both official BackOffice cases passed locally on 2026-10-14, headless, one
worker, zero retries, using the existing shared Admin credential:

- SAM-25103: basic/advanced order and product searches, plus order status readback.
- SAM-25104: configured S1 order `PE261013-63986039` is `SHIPPING_REQUESTED`.

The Jenkins provisioning correction already exists in commit `b525b45`.
PE uses the existing `samsung-mx-s2-backoffice-admin` file credential for both
staging environments. The credential ID is historical; the installed filename
is environment scoped: `playwright/.auth/backoffice-admin-${BACKOFFICE_ENV}.json`.
Buyer sessions remain separate: `samsung-pe-s1-session-bundle` for S1 and
`samsung-pe-s2-session-bundle` for S2. Never copy a buyer session across environments.

The pipeline installs the buyer bundle, copies the shared BackOffice credential,
verifies buyer authentication and then invokes the Node 22 PE runner. Both Windows
and Unix paths are covered by `governance/tests/peJenkinsLane.test.cjs`.

The archived build #131 metadata identifies checkout `0ff5d4c`, before the
BackOffice provisioning correction `b525b45`. This explains the missing
credentials in that build. The current branch includes the correction.
Evidence was read directly from the local Jenkins build archive; no Jenkins
build or credential publication was performed.

Local targeted reproduction in Bash:

```bash
PE_QST_ENVIRONMENT=S1 \
PE_QST_TARGET_IDS=SAM-25103,SAM-25104 \
PE_QST_ARTIFACT_DIR=test-results/pe-s1-backoffice \
MX_QST_HEADLESS=1 npm run qst:pe:base-store
```

Local credentials must already be available through the supported environment
secret or ignored BackOffice credential file. Never version or print them.

## Reproduced UI failures

| TC | Current evidence | Required condition |
| --- | --- | --- |
| SAM-25079 | Home footer has no navigation/heading content; original footer assertion fails. | PE S1 must serve the actual footer content. |
| SAM-25062 | Cart item and summary checks complete, then the original `Tienda` footer assertion fails. | PE S1 cart footer must render its navigation/legal content. |
| SAM-25094 | No Back to Top text/control appears after following the document end for 60 seconds. | Actual cart Back to Top control must render. |

A separate read-only diagnostic loaded the home at 1920×1080 **before navigation**,
then scrolled to the footer. It still observed empty footer text and a 24 px
footer container. Desktop sizing alone did not fix it. These official cases
remain failures; assertions were not removed and no known-defect PASS was added.

Raw local evidence: `test-results/pe-s1-build131-diagnosis/results.json` and its
Playwright screenshots/traces. The viewport diagnostic is under
`test-results/pe-s1-build131-probe/`. Diagnostic execution success is not an official
TC PASS.

## Payment safety — SAM-25099

### Latest local validation — PASS, 2026-10-14

After explicit operator authorization, one new quantity-one order was submitted
using the existing PE test card. SAM-25099 passed end to end, headless, one worker,
zero retries: Samsung displayed `¡Muchas gracias por tu compra!` and the visible
new order number **PE261014-64013107**. No runtime code or assertion change was
needed for this successful execution. This does not establish the root cause or
permanent resolution of the earlier intermittent backend rejection.

```bash
PE_QST_ENVIRONMENT=S1 PE_QST_TARGET_IDS=SAM-25099 \
PE_QST_ARTIFACT_DIR=test-results/pe-s1-confirmation-e2e \
MX_QST_HEADLESS=1 PW_TRACE=1 ALLOW_PAYMENT_SUBMIT=1 npm run qst:pe:base-store
```

Result: one passed, zero failed/skipped/flaky; runner exit 0. Raw results and
the final confirmation screenshot are under `test-results/pe-s1-confirmation-e2e/`.
No additional payment was submitted after that confirmation.

### Historical build #131 rejection

The archived Jenkins trace shows HTTP 200 for the PE Mercado Pago
`submitOrder` POST with this business response:

```json
{"type":"submitOrderDataWsDto","code":"601","details":"payment generic error","openPaymentPageInIframe":false}
```

The payment page remained visible, without an observable order number. The old
capture ignored that business rejection and eventually reported a timeout.

The current PE capture filter accepts order identity from the `/orders` API,
excluding replacement cart codes. The PE caller now separately recognizes the
exact `submitOrderDataWsDto` rejection code 601 on its card-submit endpoint and
fails immediately with a business rejection diagnostic. Arbitrary response
bodies are not logged. Other markets and order identity filtering are unchanged.
The final Samsung confirmation and matching order number remain mandatory.

The initial build #131 investigation did not resubmit payment. The later
explicitly authorized successful execution is recorded above.
Quantity-one and destructive opt-in protections remain intact.

## Services

- SAM-25074 remains blocked: the controlled S1 SKU `SM-F741BLBKPEO` exposes no
  Samsung Care+ surface. A verified eligible PE S1 SKU is still required; MX
  eligibility is not proof of PE eligibility.
- SAM-25075 was reproduced again: the wizard completes for
  `GALAXY S24 ULTRA 5G | Otros`, but the cart shows only `Trade-in device` and a
  `-` valuation. The selected model and S/ 2,200.00 are not persisted in the
  visible summary. The original model/value assertions remain failures.

Evidence: `test-results/pe-s1-build131-services/results.json` and its screenshots
and traces. One failed, one skipped; no payment was involved.

## Scope

BOGO SAM-25068 remains excluded from this follow-up per the earlier operator
instruction. The official inventory and reporting KPI layout are unchanged.

Validation: 11 focused Jenkins/payment-capture tests passed. Architecture and
official inventory gates passed. Business-step/refactor gates still fail on the
16 pre-existing CL business-step gaps; they were not changed to force a green gate.
