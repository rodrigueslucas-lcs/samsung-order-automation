# MX S2 Base Store — build 25 stabilization

## Latest official validation — 26 November 2026

The subsequent normal targeted execution of **SAM-25002 passed**, creating
the new order **MX261126-78917085** and validating its native confirmation.
The local Playwright result records one PASS, zero FAIL/SKIP, starting at
11:41:31 UTC and completing in approximately 3.6 minutes. Its order evidence
records `paymentMode: mx-mercadoCC` and `outcome: CONFIRMATION`.

```bash
MX_QST_ENVIRONMENT=S2 MX_QST_TARGET_IDS=SAM-25002 MX_QST_HEADLESS=0 ALLOW_PAYMENT_SUBMIT=1 npm run qst:mx:base-store
```

This supersedes a blanket current assertion that MX card ordering is blocked.
The earlier 601 failures below remain historical evidence; their underlying
cause and the difference between executions have not been established.
Do not impose a provider-fix prerequisite on the normal card TC from those
older failures. No successful old order may substitute for a new run's order.
SAM-25010 still requires its own new guest order and tracking validation; this
registered-card PASS does not prove that case or the complete campaign.

## Observed execution

Jenkins `Samsung-SMB-MX` build 25 ran revision
`d3145f5fc7564d1b3e11b6deaf15cf5f5fd97b5d`. Its 75-minute global deadline
interrupted the campaign after 28 of 29 cases emitted console results:
25 PASS and 3 FAIL. The remaining case has no completed result. No final
Playwright JSON or complete report was published. These are partial console
results, not a completed campaign or a new execution of the current revision.

The failed cases have distinct causes:

| TC | Proven failing step | Treatment |
| --- | --- | --- |
| SAM-24991 | A third-party payment-method GET remained pending after Delivery. This address-save/edit case did not submit a payment. | Validate the accepted Delivery transition and its mandatory checkout summary without depending on provider payment-method readiness. Keep address persistence, editing and cleanup assertions. Actual targeted rerun: PASS. |
| SAM-25002 | Registered card native submit returned HTTP 200 with business code 601 and unsuccessful-transaction UI, without captured confirmation. | Reconcile the own previous attempt before any fresh submission. Do not treat HTTP 200 or tokenization as payment approval. |
| SAM-25010 | Guest prerequisite-order native submit returned the same 601 signature, before Track Order or OTP. | Reconcile the guest attempt separately. This is not evidence of the known Track Order defect. |

SAM-24964, SAM-24968, SAM-24969 and SAM-24995 passed in build 25, consistent
with the previous targeted validation of their fixes. Historical failed
artifacts remain intact.

## Implemented corrections

- Only SAM-24991 opts out of waiting for payment-method readiness. Actual
  financial cases retain their existing strict readiness and submission guards.
- A full MX S2 `official-p1` campaign with no targeted IDs receives a 120-minute
  global budget. Individual TC limits are unchanged. Other markets, S1 and
  targeted runs retain the existing 75-minute global budget.
- An interrupted campaign without final JSON archives only the current
  Playwright artifact directory, and only if this build completed the validated
  lane cleanup. A failure before cleanup cannot archive old raw results. It does not publish an older dashboard or
  invent final TC totals. Console text distinguishes an interrupted run from
  a run that never started.
- The DST proposal's SAM-24991 source binding records the legitimate QST
  source revision. DST implementation and historical pilot outcomes are
  unchanged.
- S2 Base Store now checks that the selected native colonia survived address
  completion. If the UI cleared it, the same previously selected option is
  selected once and read back. A missing or different option still fails;
  S1 and EPP are unchanged.
- The S2 Base card response matcher recognizes both native `mx-mercadoCC`
  and `mx-mercadoCC-noMSI` submit routes. The latter is the single-payment
  card panel. Its proven 601 response now takes the existing explicit
  rejection path instead of waiting two minutes for confirmation. Cash,
  wallets, other markets and EPP are not added to that matcher.

## Reconciliation and evidence boundaries

Read-only reconciliation verified the registered identity and all 18 available
orders, including order details and a stable history reread. There was no new
registered order corresponding to either build 24 or build 25's submission.
The older guest attempt from build 24 did create a `TEMPORARY` order, despite
returning 601. Its record was reviewed in the authorized BackOffice; it was not
cancelled, paid again or counted as a newly passing TC.
The build 25 guest attempt was also reviewed by its exact QA email against a
working positive-control search: it created a `TEMPORARY` order. No native
confirmation was captured by that failed execution.

After the registered-history reconciliation, one new controlled registered
submission tested the configured card in the native single-payment panel.
The SDK fields and enabled submit were validated. Exactly one native submit
returned HTTP 200 / business code 601, the UI explicitly reported an
unsuccessful transaction, and no order confirmation was observed. This was
a diagnostic execution, not a passing official TC. Subsequent read-only
reconciliation verified the same identity, all 18 historical order details and
a stable reread, with no order since the new attempt. The preserved marker is
`RECONCILED_NO_ORDER`; there was no automatic resubmission.

A `TEMPORARY` state does not itself fail a case whose requirements are a new
order and native confirmation. However, an old order or an isolated 601 response
cannot establish those requirements. Each new payment execution must prove its
own order and confirmation, and tracking must use that same execution's order.

## Validation completed

- 17 focused readiness/pipeline tests: PASS, no skips.
- Six DST proposal/source-binding tests: PASS, no skips.
- 33 focused delivery/card capture/receipt and CL contract regression tests:
  PASS, no skips.
- Actual Jenkins Declarative model validation: HTTP 200, successful validation.
- Repository architecture, official scope and visible business-step gates: PASS.
- Actual SAM-24991 targeted headless run: 1 PASS, approximately 2.1 minutes,
  including QA address cleanup and no financial submission.
- Actual canonical registered Delivery regression with the final colonia
  correction: PASS in approximately 2.3 minutes, Payment reached and zero
  financial submissions. This does not itself pass SAM-25002.
- Final integrated `npm run repo:refactor:gate`: 1,795 governance, four
  Executive and 39 runtime/reporting checks PASS, zero FAIL or SKIP. Includes
  architecture, official scope, business-step and multi-market discovery gates.
- Final repeat of SAM-24991 with the complete correction: PASS in 2.1 minutes,
  including address persistence/edit verification and QA cleanup, no payment.

No complete MX campaign has been revalidated by these targeted checks. Card
and guest-order results must be assessed separately from this successful
address and pipeline correction.

## Historical payment escalation context

The observed 601 is a commerce/provider refusal, not proof of its underlying
cause. Request the server-side reason and correlation for the exact QA submit
timestamp, selected native payment mode, SKU/quantity and total, together with
confirmation of the approved test-card fixture and the staging merchant/test
configuration. SDK token creation is not proof that those merchant settings
are correct. Do not publish card numbers, security codes, tokens, cookies or
authenticated request bodies with that handoff.

The latest official SAM-25002 PASS above proves a new registered order and its
native confirmation. Guest ordering and Track Order require their own execution
evidence. If 601 recurs, investigate that exact attempt rather than retaining a
generic current blocker. Do not apply a Cash or Track Order known-defect label
to a card refusal.
