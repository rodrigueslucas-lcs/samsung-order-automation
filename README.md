# Samsung Peru QA Automation

Playwright automation for Samsung Peru eCommerce flows running on SAP Commerce. The repository covers storefront, Samsung Account, email, payment, BackOffice and order-fulfillment validation in the ST2/ST3 staging environments.

Production is not an automation target for state-changing tests. Existing environment and destructive-action guards must always be preserved.

DST and QST have independent specs, IDs, execution evidence and coverage. They share Page Objects, fixtures and utilities instead of duplicating interaction code.

## DST — Detailed Smoke Test

DST tracks 83 Base Store scenarios: 63 Automated, 9 Partial, 9 Blocked and 2 Not Applicable. Its broad coverage includes storefront, authenticated journeys, checkout, payments, email, BackOffice and fulfillment.

```bash
npx playwright test tests/st2/base-store --project=chromium --workers=1
npx playwright test tests/st2/backoffice --project=chromium --workers=1
npx playwright test --grep "TC<number>" --project=chromium --workers=1
npm run dst:base-store
npm run dst:backoffice
npm run dst:list
```

Detailed status and evidence: [DST Coverage Matrix](docs/COVERAGE_MATRIX.md). DST currently uses the paths above; migration to `tests/st2/dst/` remains planned and incremental.

## QST — Quick Smoke Test

QST contains 44 official scenarios: 22 Base Store and 22 EPP, organized for Normal, Modified and Sanity executions. Current Base Store status is 12 Automated, 3 Partial, 6 Blocked and 1 Reusable; the 22 EPP scenarios remain blocked because the known Peru employee-store paths redirect from ST2 to Production and no staging EPP route/entitlement has been supplied.

```bash
npm run qst:normal
npm run qst:modified
npm run qst:sanity
npm run qst:base-store
npm run qst:epp
npm run qst:list
```

Detailed status and execution guidance: [QST Coverage Matrix](docs/QST_COVERAGE_MATRIX.md) and [QST Automation Guide](docs/QST_AUTOMATION_GUIDE.md).

## Repository structure

```text
pages/                  Shared Page Objects
tests/
  st2/
    base-store/         Current DST storefront specs
    backoffice/         Current DST BackOffice specs
    qst/
      base-store/       QST Base Store specs
      epp/              QST EPP safe staging discovery and future specs
fixtures/               Synthetic QA test data
utils/                  Auth, execution-summary and test-data helpers
scripts/                Auth bootstrap and QST runner scripts
docs/                   Coverage, operating guides and handoff notes
```

Moving DST specs under `tests/st2/dst/` is planned as an incremental migration; it has not happened yet. See [DST Automation Structure](docs/DST_AUTOMATION_STRUCTURE.md).

## Setup

Install the locked dependency set:

```bash
npm ci
```

Install Playwright browser dependencies when required by the machine:

```bash
npx playwright install
```

The current Playwright configuration uses the real Chrome channel, visible mode, one worker, screenshots and failure-retained traces. Video is disabled unless `PW_VIDEO=1` is supplied.

## Authentication commands

```bash
npm run auth:open-profile
npm run auth:export
npm run auth:verify
```

## Targeted Playwright execution

```bash
npx playwright test --list
npx playwright test --grep "TC<number>" --project=chromium --workers=1
npx playwright show-report
```

There are no `dst:*` npm scripts yet; current DST execution uses the explicit paths documented in the DST section.

## Samsung Account authentication

Samsung Account may require a human login because of Google/FedCM/MFA behavior:

1. Run `npm run auth:open-profile` to open the dedicated visible Chrome profile.
2. Complete authentication manually.
3. Keep that Chrome open and run `npm run auth:export` in another terminal.
4. Run `npm run auth:verify` to validate the exported session.

The dedicated profiles and `playwright/.auth/` state are ignored by Git. Authenticated tests skip with a bootstrap instruction when the session files are unavailable; expired sessions must be refreshed rather than embedding credentials in specs.

## Email and Guest tracking

`MailinatorPage` provides reusable UI automation for:

- order acknowledgment/payment email validation;
- Guest Order Tracking OTP retrieval.

Public inboxes must contain only synthetic QA data. Never document real inboxes, personal email addresses, OTPs or tokens. Public delivery can be delayed, so email-dependent coverage may remain Partial when no stable private inbox integration exists.

## Payments and destructive guards

Place Order and external payment-provider submits are opt-in:

```text
ALLOW_PAYMENT_SUBMIT=1
```

Without this guard, destructive payment tests skip. A permitted execution must use staging test data, one worker and no retry after an ambiguous submit. Payment fixture values must not be copied into logs, reports or documentation.

Other runtime controls include:

- `STOREFRONT_PAYMENT_MODE` for an approved alternative-payment probe;
- `VALIDATE_ORDER_EMAIL`, `STOREFRONT_GUEST_EMAIL` and `MAILINATOR_INBOX` for synthetic email validation;
- `GUEST_TRACKING_ORDER` and `GUEST_TRACKING_EMAIL` for Guest tracking;
- `PW_VIDEO=1` to opt in to Playwright video.

## BackOffice and fulfillment

BackOffice supports S1/S2/S3 staging through `BACKOFFICE_ENV` or an explicit `BACKOFFICE_URL`. Credentials are runtime-only:

```text
BACKOFFICE_USERNAME
BACKOFFICE_PASSWORD
BACKOFFICE_ADMIN_USERNAME
BACKOFFICE_ADMIN_PASSWORD
```

Login, order-status and CronJob helpers already exist. Fulfillment CronJobs are guarded for S3 and require administrator credentials plus suitable staging mass. Never run a CronJob merely to test a locator, and never persist credentials, cookies or tokens.

## Production safety

- Never create an order in Production.
- Never submit a Production payment.
- Never run a Production CronJob or cancellation.
- Never alter Production customer, address or order data.
- Preserve all environment, credential and destructive-action guards.
- Use Production only when a specifically authorized workflow is strictly read-only.

## QST execution summary

`utils/qstExecutionSummary.js` attaches structured execution metadata for:

- Environment
- Version/Build
- Type of QST
- Date
- Country Code
- Store Type
- Order Number
- Defect Found
- Tester Name

The helper prepares data for manual reporting; it does not write to Confluence. Variables and defaults are documented in the [QST Automation Guide](docs/QST_AUTOMATION_GUIDE.md).

## Evidence and local artifacts

Playwright reports, traces, screenshots, auth state and browser profiles are local artifacts and are protected by `.gitignore`. Review `git status` before every commit to ensure no session or test-result artifact is staged.

## Documentation

- [DST Coverage](docs/COVERAGE_MATRIX.md)
- [QST Coverage](docs/QST_COVERAGE_MATRIX.md)
- [QST Automation Guide](docs/QST_AUTOMATION_GUIDE.md)
- [DST Automation Structure](docs/DST_AUTOMATION_STRUCTURE.md)
- [Office QA Handoff](docs/OFFICE_QA_HANDOFF.md)
