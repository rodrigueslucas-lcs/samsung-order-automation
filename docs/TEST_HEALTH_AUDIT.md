# Test Health Audit

**Date:** 2026-08-31  
**Scope:** local repository, read-only suite inventory plus safe guard fixes

## Suite health

- Playwright lists 138 tests globally: 121 DST tests and 17 QST tests.
- DST EPP contains 18 executable thin-wrapper tests covering 31 official IDs; without runtime EPP configuration all 18 skip safely.
- No exact duplicate full test titles were found.
- Repeated Base Store IDs such as TC12, TC61 and TC78-TC80 are intentional coverage from different flows/specs, not identical test titles.
- QST official test titles retain `@qst`; EPP discovery probes do not claim official scenario IDs.
- No auth state, browser profile, report, test result or screenshot evidence is tracked by Git.
- No broken imports were reported by Playwright list discovery.

## Production safety

- The only executable EPP Production host reference is the explicit block route in `tests/st2/qst/epp/discovery.spec.js`.
- `utils/eppConfig.js` rejects known Samsung Production storefront hosts and requires a staging-like or explicitly allowlisted hostname.
- DST TC58 and TC83 were hardened to require `ALLOW_PAYMENT_SUBMIT=1`, matching the other destructive Place Order tests.
- `PaymentPage` now enforces `ALLOW_PAYMENT_SUBMIT=1` at both submit entry points, so callers cannot bypass the spec-level guard accidentally.
- `BackOfficeCronJobsPage.runCronJob()` enforces `ALLOW_CRONJOB_RUN=1`; TC73 and TC75 also skip without that explicit opt-in.
- The current cancellation automation only discovers/opens the editor and has no Save/confirm method, so there is no cancellation execution path to guard.
- No Production write, payment, CronJob, cancellation or account mutation was executed.

## Sensitive-data scan

| Category | Files | Assessment |
|---|---|---|
| BackOffice password variables | `BackOfficePage.js` and BackOffice specs | Safe: runtime environment variables; no literal credential found |
| Payment test data | `fixtures/card.json`, `PaymentPage.js` | Needs controlled handling: synthetic staging fixture is intentionally tracked; values must never be printed or copied to docs |
| Synthetic customer email | `fixtures/customer.json`, tracking helper | Safe for staging; no personal mailbox identified |
| OTP handling | tracking/Mailinator pages and tracking spec | Safe: extracted at runtime and not persisted |
| Auth/cookie state | auth scripts and `authState.js` | Safe: paths are Git-ignored; no tracked state artifact found |

## Regression and migration

- Homepage and PDP headed Chrome regressions passed before the Search migration check.
- The migrated Search spec is collected from `tests/st2/dst/base-store/search/` with its shared import intact.
- Its first headed run completed the functional assertions but timed out capturing full-page evidence; `BasePage.screenshot()` now retries a viewport capture only when the full-page screenshot itself times out.
- Its second headed run received a completely blank ST2 document and failed waiting for the search control. No locator change was made because the evidence indicates environment loading, not selector ambiguity.

## Deferred cleanup

- Do not merge overlapping DST specs merely to remove repeated IDs; they validate different boundaries and require a dedicated refactor/test run.
- Continue legacy DST migration one low-coupling domain at a time; update external CI/Confluence consumers before removing any remaining compatibility path.
- Historical staging order codes remain evidence/test fallbacks in existing documentation/specs; they are not credentials, but should not be treated as durable architecture.
