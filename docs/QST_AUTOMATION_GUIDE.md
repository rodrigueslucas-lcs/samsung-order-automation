# QST Peru Automation Guide

## Scope and separation from DST

QST is an operational suite independent from the 83-case Detailed Smoke Test (DST). QST specs may reuse the existing Page Objects and helpers, but QST IDs, coverage, execution and evidence remain separate. This work does not change DST coverage.

The official QST scope contains 22 Base Store scenarios and 22 EPP scenarios.

## Execution types

- **Normal:** regular QST coverage when no targeted code-change validation is required.
- **Modified:** the applicable subset for a changed service, functionality or pull request.
- **Sanity:** the minimum subset for configuration changes, restarts and upgrades without a code change.

A scenario has one implementation and carries every applicable tag; implementations are not copied per execution type.

## Structure and tags

```text
tests/s2/pe/qst/
  base-store/
  epp/
```

Shared tags are `@qst`, `@qst-normal`, `@qst-modified`, `@qst-sanity`, `@base-store` and `@epp`. Shared Page Objects remain under `pages/`; QST-only execution metadata lives in `utils/qstExecutionSummary.js`.

## Commands

```bash
npm run qst:normal
npm run qst:modified
npm run qst:sanity
npm run qst:base-store
npm run qst:epp
```

The cross-platform runner sets `QST_TYPE`, selects the matching tag, excludes `@destructive`, and uses one worker with zero retries. Playwright uses the real Chrome channel and visible mode through `playwright.config.js`.

## Execution summary

Each implemented QST attaches a JSON summary to Playwright containing:

| Field | Variable/default |
|---|---|
| Environment | `QST_ENVIRONMENT` / `ST2` |
| Version | `QST_VERSION` / `not supplied` |
| Type of QST | Set by the npm command |
| Date | ISO timestamp generated at runtime |
| Country Code | `QST_COUNTRY_CODE` / `PE` |
| Store Type | Set by the spec |
| Order Number | `QST_ORDER_NUMBER` / `not applicable` |
| Defect Found | `QST_DEFECT_FOUND` / `not supplied` |
| Tester Name | `QST_TESTER_NAME` / `not supplied` |

This prepares evidence for manual Confluence reporting; it does not write to Confluence.

## Authentication and environments

- Base Store guest wrappers use ST2 Peru and the existing `getcookie.html` setup.
- Registered scenarios reuse the ignored Playwright auth state only when a QST wrapper is implemented and a valid QA session exists.
- BackOffice scenarios support S1/S2/S3 staging through `BACKOFFICE_ENV` (or explicit `BACKOFFICE_URL`) and must keep runtime-only credentials, environment guards and the established authority selection.
- EPP is blocked until its real non-Production URL, store identifier, login/bootstrap flow, entitlement and compatible test data are supplied and verified. The authenticated ST2 Base Store state is valid, but it does not expose an EPP entry. The known official Peru paths `/pe/multistore/beneficios_empleados/` and `/pe/multistore/ventaempleados/` leave ST2 and resolve to Production when opened in a browser, so functional automation deliberately stops before navigation, product or cart interaction.

## Destructive guards

- External payment submission/order creation requires `ALLOW_PAYMENT_SUBMIT=1`.
- BackOffice state-changing flows retain their existing environment and credential guards.
- Place Order remains opt-in and must never be retried after an ambiguous submit. The controlled expansion created one ST2 guest order for QST-BS-13/14.
- Cancellation, CronJobs and all Production writes remain unexecuted.
- QST-BS-16 has a guarded registered-order wrapper, mode-specific payment marker and support for selecting every delivery group in a mixed cart. The authorized Pago Efectivo request was `POST .../paymentmodes/pe-pagoEfectivo/submitOrder`; it completed as HTTP 200 in about 8.7 seconds but returned functional error `code=601`, `details=payment generic error`, and `openPaymentPageInIframe=false`. It returned no provider URL, CIP or order code, and My Orders showed no new entry. It was not retried.
- A read-only S1 Admin scan opened all 50 accessible orders and found only `COMPLETED`; QST-BS-20/21/22 therefore remain blocked without executing either job.

## Adding coverage without duplicating DST

1. Add or extend a logically grouped spec under the correct QST store directory.
2. Reuse a Page Object/helper; do not copy a complete DST spec.
3. Add the QST ID and only the applicable execution tags to one test.
4. Attach `annotateQstExecution`.
5. Preserve all destructive and environment guards.
6. Run the specific QST safely, then update `QST_COVERAGE_MATRIX.md`. Existing DST similarity alone is not evidence for `Automated`.

## Known blockers

- ST2 main-navigation category links point to Production and expose no safe staging PLP route; QST-BS-02/03 are blocked.
- QST-BS-05 asks for variants other than color; current DST evidence covers color only.
- Samsung Care+ depends on currently available eligible product/service mass and remains Partial in DST.
- Registered ordering remains reusable but unproven because the single Pago Efectivo submit had an ambiguous result and generated no observable order. Confirmation email could not run without that order; causal fulfillment still needs S1 test mass.
- EPP has a read-only staging discovery spec, but no verified functional runtime configuration. Discovery probes must not be reported as official QST scenario passes.
