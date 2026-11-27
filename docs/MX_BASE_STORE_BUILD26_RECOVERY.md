# MX S2 Base Store — builds 26 and 27

## Verified failures

Build 26 checked out `db0ecb24bd40ff154c69f7381754687278049480` and
completed all 29 official cases: **27 PASS, 2 FAIL, zero SKIP**. Registered
card payment and Track Order passed in that campaign.

| Case | Evidence | Cause and correction |
| --- | --- | --- |
| SAM-24969 | BC cart contained five units of `SM-F956BAKMLTM`; the native quantity input had `max="5"`. The assertion expected six but the cart remained at five. | The persistent PreQA cart had accumulated quantities across executions. Prepare one slot for that exact SKU only when it has reached the native maximum; verify the decrement response, UI value and persistence after reload. Then require the original Add-to-Cart success, exact +1 increment and another persisted reload. No SKU substitution, relaxed assertion or retry of Add. |
| SAM-25011 | Before login, BackOffice rendered “403: The server did not authorize the request.” | Access was denied before application authentication. This does not prove maintenance, a bad password or a specific VPN state. On 27 November the same endpoint returned HTTP 200 with its login form, and the actual official targeted test passed basic/advanced order and product search and read the order status. No access-control bypass or retry of 403 was introduced. |

Build 27 did **not** execute the suite. Jenkins failed while fetching its
pipeline from GitHub: connection to `github.com:443` failed after 21 seconds.
This happened before the Jenkinsfile and cannot be attributed to BackOffice
or counted as 29 executed failures. A subsequent read-only `git ls-remote`
succeeded. Corporate network policies and authentication remain unchanged.

## Implementation boundaries

`utils/mxBcCartHeadroom.cjs` accepts only the S2 MX Base Store cart and scopes
the action to the exact configured BC SKU. Below the limit, it leaves the cart
unchanged. At the limit, it clicks the native minus button once, checks the
exact staging cart-entry response, and verifies server persistence through
reload. Invalid quantities, ambiguous rows, rejected updates and a one-unit
limit fail explicitly. Other cart items are preserved.

The shared BC flow keeps its existing variant, Canje/Care choices, successful
native Add, exact quantity increase and persistence assertions. DST attribute
checks and trace hooks are preserved. Historical DST source hashes and pilot
results remain intact; the source evolution is recorded separately so a new
QST fix does not rewrite the historical runtime evidence.

## Current buying-page data and complete official path

On 27 November the old Fold6 buy URL returned a genuine HTTP 404, independently
reproduced in the authenticated PreQA context. The catalog still advertised
that broken destination. This is separate from build 26's quantity-limit failure.

The detailed official source `Samsung_MX_QST_37_TCs_Detalhados.xlsx`,
`MX_QST_37!A34:I34`, explicitly permits **any product from PLP**, followed by
PDP variant selection, Add, price and colour. The QST fixture now uses the
actually listed `SM-A065MLBALTM` (Galaxy A06). Its buy URL was read from the
catalog/detail page, not invented. Read-only inspection proved HTTP 200,
native selected Azul Claro / 64 GB controls, price 2,599.00, and an enabled
exact-SKU Add action.

The existing shared BC flow gains an explicit MX classic-PDP mode. Other
market callers retain their existing card mode. MX navigates through the
observed native product and buy links, actually selects colour/storage,
compares the rendered and native price, selects the offered Canje opt-out,
then submits one native Add and verifies exact +1 and persistence. It does not
replace a PDP scenario with a PLP-card shortcut. The old DST fixture, its
price/colour checks and its historical results are preserved.

Actual official targeted results after the changes:

- SAM-25011: PASS, basic/advanced order and product search, including status,
  approximately 3.1 minutes total.
- SAM-24969: PASS, full PLP/PDP/variant/Add/persisted-cart path, approximately
  three minutes total. Initial target quantity zero became one.
- SAM-24969 repeated without a cart reset: PASS, initial quantity one became
  two and persisted. The native A06 cart limit was two; the correction reads
  that live limit rather than assuming every product allows five.
- SAM-24969 third execution, naturally at that limit: PASS. The recorded
  preparation proves original quantity two / maximum two, one accepted and
  persisted decrement to one, then native Add back to two and another reload.
  Thus three consecutive BC executions passed, including the saturation case.

Focused validation: 13 cart-headroom/BC-selector/trace checks, six classic-PDP
and shared-scope checks, and six official-provenance checks passed without
skips. Architecture, official scope and business-step gates passed.
The integrated refactor gate also passed: 1,805 governance, four Executive,
and 39 runtime/reporting checks. These are static/discovery/contract results,
separate from the two unique official TCs executed above.

No payment was submitted during the targeted diagnosis of these two cases.
The 27 PASS from build 26 are historical campaign evidence, not a claim that
a new full campaign has passed.
