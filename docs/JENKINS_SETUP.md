# Samsung SMB Automation — Jenkins Setup

## Current CI scope

The repository `Jenkinsfile` supports the active MX Base Store P1/QST campaign on S1/STG or S2/STG2 and the current PE stabilization lane.

For MX, the source Base Store inventory contains 30 historical P1 rows, but `SAM-25006` is an auditable market-applicability exclusion. The active MX Base Store runner therefore selects **29 TCs**.

The pipeline validates official inventory before execution, injects runtime secrets, runs controlled Playwright execution, archives evidence and publishes the Executive Dashboard, Allure and Playwright reports.

## Proven MX S2 baseline

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

This is the regression baseline for CI/refactor changes that affect MX.

## Jenkins agent prerequisites

- Git access to the repository.
- Node.js 24.x and npm.
- Chrome/Playwright browser support for the selected evidence mode.
- Network/VPN access to Samsung staging, BackOffice, Mailinator and approved payment providers used by the selected tests.
- Workspace write permission.
- HTML Publisher plugin.
- Allure Jenkins plugin when native publication is desired.

The Jenkinsfile supports Windows and Unix agents.

## Runtime credentials

Authentication/payment/BackOffice data is runtime-only and must never be committed or archived.

### MX S1

```text
samsung-mx-s1-auth-state
samsung-mx-s1-session-storage
```

### MX S2 primary account

```text
samsung-mx-s2-auth-state
samsung-mx-s2-session-storage
```

### MX S2 second account — SAM-24986

```text
samsung-mx-s2-second-auth-state
samsung-mx-s2-second-session-storage
```

### MX payment / BackOffice

```text
samsung-mx-test-card
samsung-mx-s2-backoffice-admin
```

The pipeline copies selected secrets into ignored `playwright/.auth/` for the build and removes that directory in post actions.

## Approved MX auth lifecycle

Primary S2 login + verification:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:login:mx && MX_QST_ENVIRONMENT=S2 npm run auth:verify:mx
```

Second-account S2 login + verification:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second MX_AUTH_MANUAL=1 node scripts/auth-login-mx.cjs && MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second npm run auth:verify:mx
```

Then upload the refreshed secret files and run P1 directly.

### Important session policy

Do **not** insert an `authenticated-safe` build between refreshed credential upload and the intended full P1 merely as a ritual. Samsung session rotation/refresh behavior has previously made that extra use counterproductive. The P1 runner already performs primary and, when required, second-account preflight verification in the same workspace immediately before execution.

Use `authenticated-safe` as a diagnostic profile when you specifically want to investigate authentication, not as a mandatory step between upload and P1.

Jenkins intentionally sets `MX_AUTH_AUTO_RENEW=0`; a service agent must not attempt interactive MFA/CAPTCHA renewal in the background.

## Job configuration

Recommended: Pipeline or Multibranch Pipeline from SCM.

Repository:

```text
rodrigueslucas-lcs/samsung-order-automation
```

Script path:

```text
Jenkinsfile
```

Current development branch:

```text
agent/mx-qst-p1-finish
```

## Execution parameters

### MARKET / ENVIRONMENT

Select the intended market/environment explicitly. For current stabilized MX use `MX` + `S2` unless validating S1 parity.

### TEST_SUITE

- `fast-guest` — 14-TC non-destructive MX guest-safe subset.
- `authenticated-safe` — authentication diagnostic profile.
- `official-p1` — active official MX Base Store P1 campaign (29 TCs when no target filter is supplied).
- `backoffice-safe` — read-only BackOffice profile.
- `allure-smoke` — reporting/plugin smoke validation.

### EXECUTION_MODE

MX `official-p1` contains state-changing/payment/order scenarios and requires `authorized-destructive`.

### BROWSER_MODE

`headless` is recommended for Jenkins service agents.

### EVIDENCE_MODE

- `screenshots-trace`
- `screenshots-trace-video`

When video mode is selected, Playwright records video for the suite according to the current config. Keep video when full visual evidence is required; do not change evidence behavior merely for refactor convenience.

### P1_TARGET_IDS

Optional MX official-p1 stabilization filter. Example:

```text
SAM-24969,SAM-24991,SAM-25002
```

Only active official MX Base Store IDs are accepted. Leave blank for the full active 29-TC campaign.

Targeted execution is for fast CI validation of changed/problematic TCs; it does not redefine official scope.

## Pipeline flow

1. Build Context
2. Checkout
3. Validate Request
4. Agent Health
5. Dependencies
6. Official Coverage Gate
7. Selected execution lane
8. Finalize Reports
9. Quality Summary
10. Post actions/publication

## Official scope gate

The pipeline validates the 362-row Samsung priority model and the active market runner.

For MX:

- source Base Store P1 rows: 30;
- active runner: 29;
- exclusion: `SAM-25006`, preserved for audit.

A targeted run validates its requested IDs against the active runner set.

## MX P1 execution behavior

The active runner:

- validates primary auth before execution;
- validates second-account auth only when `SAM-24986` is selected;
- executes `mx-auth-priority` before the remaining chromium project;
- uses one worker and zero retries for the controlled campaign;
- enables approved destructive flags only inside the authorized non-Production runner;
- reconciles actual Playwright output into runtime summary/reporting.

Current full-P1 concurrency remains intentionally conservative because registered/cart/profile/payment scenarios share state. Do not increase workers across the full campaign without an isolated runtime proof.

## Runtime and evidence

Runtime statuses include PASS, FAIL, BLOCKED/SKIPPED-BLOCKED and NOT_RUN. Missing evidence is never inferred as PASS.

Evidence can include:

- screenshots;
- traces;
- videos when enabled;
- error context;
- business metadata;
- safely recorded order/payment identifiers.

Never archive `playwright/.auth/`.

## Published reports

### Executive Dashboard

Outcome-first build/release health and evidence view.

### Allure

Technical Samsung hierarchy, SAM/Jira IDs, steps, categories and attachments.

### Playwright

Low-level execution and trace investigation.

### Jenkins Stage View

Operational orchestration/gate visibility.

## HTML Publisher and Resource Root

Prefer Jenkins HTML Publisher links over raw HTML artifacts. JS-heavy Playwright reports may require Jenkins Resource Root on a different origin. Do not globally weaken Jenkins CSP merely to render reports.

## Allure publication

The project produces Allure results and the Jenkins plugin can publish native history. Generated HTML remains a fallback where native publication is unavailable.

The MX runner avoids generating the same Allure HTML twice during CI; finalization/publication owns the CI report generation.

## Clean-build checklist

1. Pull/build the intended branch revision.
2. Confirm corporate network/VPN access.
3. Confirm Agent Health versions/tools.
4. Confirm required secret files exist.
5. For expired auth, refresh + verify locally and upload the fresh artifacts.
6. Run the intended targeted lane when validating a small code change.
7. Use full P1 only after targeted fixes are proven where applicable.
8. Confirm selected count/IDs in Build Context and runner output.
9. Confirm Executive, Allure and Playwright publication.
10. After an ambiguous payment/order submit, inspect evidence/order state before rerunning.

## Security and safety

- Never commit passwords, cookies, tokens, session storage, payment test data or Jenkins secrets.
- Never archive `playwright/.auth/`.
- Production is read-only.
- No blind retry after ambiguous payment/order submission.
- MFA/CAPTCHA is never bypassed.
- Real backend/environment defects remain failures; assertions are not weakened just to make CI green.
