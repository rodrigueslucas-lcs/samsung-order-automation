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
tests/st2/qst/
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

The cross-platform runner sets `QST_TYPE`, selects the matching tag and uses one worker. Playwright currently uses the real Chrome channel and visible mode through `playwright.config.js`.

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
- BackOffice scenarios must keep runtime-only credentials, environment guards and the established authority selection.
- EPP is blocked until its real non-Production URL, store identifier, login/bootstrap flow, auth state and compatible test data are supplied and verified. Base Store behavior must not be assumed for EPP.

## Destructive guards

- External payment submission/order creation requires `ALLOW_PAYMENT_SUBMIT=1`.
- BackOffice state-changing flows retain their existing environment and credential guards.
- QST discovery must not run Place Order, cancellation, CronJobs or Production writes.
- QST-BS-13/14/16/17/20/21/22 and EPP equivalents are mapped for reuse but are deliberately not part of the initial safe execution.

## Adding coverage without duplicating DST

1. Add or extend a logically grouped spec under the correct QST store directory.
2. Reuse a Page Object/helper; do not copy a complete DST spec.
3. Add the QST ID and only the applicable execution tags to one test.
4. Attach `annotateQstExecution`.
5. Preserve all destructive and environment guards.
6. Run the specific QST safely, then update `QST_COVERAGE_MATRIX.md`. Existing DST similarity alone is not evidence for `Automated`.

## Known blockers

- PLP navigation/attributes lack a verified reusable PLP implementation.
- QST-BS-05 asks for variants other than color; current DST evidence covers color only.
- Samsung Care+ depends on currently available eligible product/service mass and remains Partial in DST.
- Address, payment, confirmation, registered ordering, email and fulfillment need dedicated guarded QST wrappers and/or test data.
- EPP has no verified runtime configuration or implementation in this repository.
