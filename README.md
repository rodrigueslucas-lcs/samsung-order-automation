# Samsung LATAM QA Automation

Playwright automation for Samsung LATAM eCommerce flows running on SAP Commerce. The repository currently contains validated automation for Mexico and Peru, with country, environment, suite and store boundaries being standardized incrementally.

Production is read-only. State-changing automation is restricted to explicitly authorized staging targets and guarded at runtime.

## Current scope

The execution identity has four dimensions:

| Dimension | Current values |
|---|---|
| Environment | S1, S2 and S3 where applicable |
| Country | MX and PE |
| Suite | DST and QST |
| Area | Base Store, EPP and BackOffice/Fulfillment |

Chile (`CL`) and Colombia (`CO`) are planned target countries only. No CL or CO automation coverage is claimed until verified configuration, tests and execution evidence exist.

Current implementations include:

- MX S1 DST Base Store and read-only BackOffice wrappers under the country-scoped structure.
- PE DST Base Store and EPP are normalized under `tests/s2/pe/dst`; PE BackOffice remains under the legacy `tests/st2/backoffice` path.
- PE QST Base Store and EPP discovery under the existing legacy `tests/st2/qst` structure.
- PE fulfillment evidence that may execute against S3 through explicit BackOffice environment configuration.

`ST2` remains in legacy Peru BackOffice and QST paths, test names and historical documentation. It represents the repository's historical naming; normalization to the `s2/pe/...` convention is incremental and does not rewrite execution evidence.

## Coverage

Coverage is country-, suite- and store-specific. Historical manual Pass results never imply current automation.

### Peru DST

The verified PE Base Store matrix contains 83 scenarios: 63 Automated, 9 Partial, 9 Blocked and 2 Not Applicable.

```bash
npm run dst:base-store
npm run dst:backoffice
npm run dst:epp
npm run dst:list
```

Detailed evidence: [PE DST Coverage Matrix](docs/COVERAGE_MATRIX.md).

PE DST EPP is tracked independently in the [DST EPP Coverage Matrix](docs/DST_EPP_COVERAGE_MATRIX.md). Its 59 historical manual Pass results are reuse context, not current automation evidence. Functional execution remains guarded by verified non-Production EPP configuration.

### Mexico DST

The verified MX S1 Base Store matrix contains 84 official scenarios: 31 Automated, 13 Reusable, 4 Partial and 36 Blocked.

```bash
npm run dst:mx:list
npm run dst:mx:base-store
```

The destructive MX order probe remains isolated and must never be included in the default Base Store command:

```bash
ALLOW_PAYMENT_SUBMIT=1 npm run dst:mx:order
```

On PowerShell, set the variable for the current process before running the command:

```powershell
$env:ALLOW_PAYMENT_SUBMIT = "1"
npm run dst:mx:order
```

Detailed evidence: [MX S1 DST Base Store Coverage Matrix](docs/DST_MX_BASE_STORE_COVERAGE_MATRIX.md).

### Peru QST

PE QST contains 44 official scenarios: 22 Base Store and 22 EPP. The currently verified Base Store status remains 12 Automated, 3 Partial, 6 Blocked and 1 Reusable. The 22 EPP scenarios remain blocked pending a verified staging EPP route, entitlement and test data.

```bash
npm run qst:normal
npm run qst:modified
npm run qst:sanity
npm run qst:base-store
npm run qst:epp
npm run qst:list
```

Detailed evidence: [QST Coverage Matrix](docs/QST_COVERAGE_MATRIX.md) and [QST Automation Guide](docs/QST_AUTOMATION_GUIDE.md).

## Repository structure

### Current structure

```text
pages/                              Shared and currently reusable Page Objects
tests/
  s1/
    mx/
      dst/
        base-store/                 MX S1 DST storefront and checkout specs
        backoffice/                 MX S1 DST BackOffice specs
  st2/                              Legacy PE environment/path naming
    backoffice/                     Current PE DST BackOffice and fulfillment specs
    qst/
      base-store/                   PE QST Base Store specs
      epp/                          PE QST EPP discovery
  s2/
    pe/
      dst/
        base-store/                 Normalized PE DST Base Store specs
        epp/                        Guarded PE DST EPP wrappers
fixtures/                           Synthetic QA test data
utils/                              Configuration, auth, safety and reporting helpers
scripts/                            Authentication bootstrap and QST execution helpers
docs/                               Coverage, discovery and operational documentation
```

PE DST Base Store and EPP are normalized. BackOffice and QST remain on legacy `tests/st2` paths and must not be assumed migrated.

### Target convention

New country/environment work should converge on:

```text
tests/<environment>/<country>/<suite>/<area>/
```

Examples:

```text
tests/s1/mx/dst/base-store/
tests/s1/mx/dst/backoffice/
tests/s2/pe/dst/base-store/
tests/s2/pe/qst/epp/
tests/s3/pe/dst/backoffice/
```

Directories for unsupported targets are not created in advance. Migration remains structural and incremental so validated tests, imports, commands and evidence can be checked after each move.

## Setup

Install the locked dependency set:

```bash
npm ci
```

Install Playwright browser dependencies when required:

```bash
npx playwright install
```

Playwright uses the real Chrome channel, visible mode, one worker, screenshots and failure-retained traces. Video is disabled unless `PW_VIDEO=1` is supplied.

There is no global Peru `baseURL` in `playwright.config.js`. Current flows navigate through explicit absolute target URLs or guarded country/store configuration. Future relative navigation must use an explicit target resolver rather than silently assuming PE.

## Targeted execution

```bash
npx playwright test --list
npx playwright test --grep "TC<number>" --project=chromium --workers=1
npx playwright show-report
```

MX S1 direct paths use the country-scoped structure:

```bash
npx playwright test tests/s1/mx/dst/base-store --project=chromium --workers=1 --grep-invert @destructive
npx playwright test tests/s1/mx/dst/backoffice --project=chromium --workers=1
```

PE Base Store commands now collect only the normalized path. BackOffice and QST continue to use legacy compatibility paths.

## Authentication

The current Samsung Account bootstrap is PE S2-specific and may require human interaction because of Google/FedCM/MFA behavior:

1. Run `npm run auth:open-profile` to open the dedicated visible Chrome profile.
2. Complete authentication manually.
3. Keep Chrome open and run `npm run auth:export` in another terminal.
4. Run `npm run auth:verify` to validate the exported session.

Dedicated profiles and `playwright/.auth/` state are ignored by Git. Credentials, cookies and tokens must remain runtime-only. PE authentication state must not be assumed valid for MX, CL, CO or EPP.

## EPP

EPP coverage is independent from Base Store coverage. The current EPP implementation is PE-oriented and accepts verified runtime-only staging configuration. Known Production redirects are blocked and never treated as functional staging evidence.

Required EPP URLs, entitlement, SKUs, payment modes and BackOffice mapping must be verified per country before automation is promoted. See [EPP Discovery](docs/EPP_DISCOVERY.md) and [EPP External Dependencies](docs/EPP_EXTERNAL_DEPENDENCIES.md).

## Email and Guest tracking

`MailinatorPage` provides reusable UI automation for order email validation and Guest Tracking OTP retrieval. Public inboxes must contain only synthetic QA data. Never document personal email addresses, OTPs or tokens.

Email templates, tracking routes and order-code formats are country-specific. Existing evidence must not be transferred between MX and PE without a causal execution.

## BackOffice and fulfillment

Shared Page Objects support S1, S2 and S3 staging through `BACKOFFICE_ENV` or an explicit `BACKOFFICE_URL`. Credentials are runtime-only:

```text
BACKOFFICE_USERNAME
BACKOFFICE_PASSWORD
BACKOFFICE_ADMIN_USERNAME
BACKOFFICE_ADMIN_PASSWORD
```

BackOffice specs remain owned by their country, suite and environment even when they reuse the same Page Objects. Never execute a CronJob without controlled causal staging mass and explicit authorization.

## Destructive-action safety

Production is strictly read-only:

- Never create an order or submit a payment in Production.
- Never run a Production CronJob or cancellation.
- Never alter Production customer, address or order data.
- Never navigate into Production to continue a staging test.

Payment/order submit requires:

```text
ALLOW_PAYMENT_SUBMIT=1
```

CronJob execution requires:

```text
ALLOW_CRONJOB_RUN=1
```

Additional rules:

- Every destructive test must carry `@destructive`.
- Default non-destructive commands must exclude `@destructive`.
- Destructive execution must use `--workers=1 --retries=0`.
- Never perform a blind or automatic retry after an ambiguous submit.
- Do not create another order only to obtain confirmation or email evidence.
- Do not cancel an order that was not created and controlled by the automation.
- Do not execute fulfillment jobs without a causal eligible order.
- Preserve country/environment host guards, including the exact MX S1 guard for `stg.shop.samsung.com`.

## QST execution summary

`utils/qstExecutionSummary.js` attaches Environment, Version/Build, QST type, Date, Country Code, Store Type, Order Number, Defect Found and Tester Name metadata. Current defaults are PE-oriented legacy defaults and must be overridden explicitly when future country QST support is added.

The helper prepares data for manual reporting; it does not write to Confluence.

## Evidence and local artifacts

Playwright reports, traces, screenshots, auth state and browser profiles are local artifacts protected by `.gitignore`. Review `git status` before every commit so no session or test-result artifact is included.

Coverage status changes require an explicit scenario mapping, executable assertion and actual environment evidence. Structural similarity or historical manual Pass is insufficient.

## Documentation

- [PE DST Coverage](docs/COVERAGE_MATRIX.md)
- [MX S1 DST Base Store Coverage](docs/DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [PE DST EPP Coverage](docs/DST_EPP_COVERAGE_MATRIX.md)
- [PE QST Coverage](docs/QST_COVERAGE_MATRIX.md)
- [QST Automation Guide](docs/QST_AUTOMATION_GUIDE.md)
- [DST Automation Structure](docs/DST_AUTOMATION_STRUCTURE.md)
- [Office QA Handoff](docs/OFFICE_QA_HANDOFF.md)
- [Documentation index](docs/README.md)
