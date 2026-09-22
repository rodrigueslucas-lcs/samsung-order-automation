# Samsung SMB Automation - Jenkins Setup

## Current CI scope

The repository `Jenkinsfile` supports the official MX Base Store P1/QST campaign on **S1/STG or S2/STG2**.

The pipeline validates the official inventory before execution, uses controlled Playwright workers/retries, supports Windows and Unix agents, can run headless, injects runtime secrets from Jenkins Credentials, archives evidence and publishes the Executive Dashboard, Allure and Playwright reports.

The same official MX Base Store P1 inventory is reused across S1 and S2; environment selection changes configuration, not the TC list.

## Jenkins agent prerequisites

- Git access to this repository.
- Node.js 24.x project baseline and npm.
- Google Chrome available to the agent (`playwright.config.js` uses the Chrome channel where configured).
- Network/VPN access to the selected Samsung environment and every endpoint used by the selected tests, including BackOffice, Mailinator and approved payment providers when applicable.
- Workspace write permission.
- HTML Publisher plugin for published HTML reports.
- Pipeline Stage View plugin for the Jenkins job stage matrix.
- Allure Jenkins plugin if native Jenkins Allure publication is enabled.

A Linux agent is preferred if available, but the Jenkinsfile supports Windows agents as well.

## Runtime credentials and auth state

Authentication state and approved payment data are runtime-only. They must never be committed or archived.

Use Jenkins **Secret file** credentials with these IDs:

```text
S1
  samsung-mx-s1-auth-state
  samsung-mx-s1-session-storage

S2
  samsung-mx-s2-auth-state
  samsung-mx-s2-session-storage

Payment test data
  samsung-mx-test-card
```

The pipeline copies the selected environment files into the gitignored `playwright/.auth/` directory only for the build and removes that directory in `post { always { ... } }` before artifact publication.

Generate or refresh MX auth state through the approved local flow, explicitly selecting the target environment when needed:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:login:mx
```

or:

```bash
MX_QST_ENVIRONMENT=S1 npm run auth:login:mx
```

Upload the resulting environment-specific auth-state and session-storage files to the matching Jenkins Secret file credentials. Do not manually edit cookies and do not bypass MFA/CAPTCHA.

## Authentication behavior

Registered-user tests validate the persisted MX session before continuing.

For a recoverable auth failure such as an expired Samsung Account session, unusable saved auth state or expired setup cookie, the authenticated fixture can perform **one controlled renewal**, then reload the new cookies/local/session storage into the already-running Playwright context and prove authentication again before the TC continues.

Auto-renew policy:

```text
Local execution:
  enabled by default
  MX_AUTH_AUTO_RENEW=0 disables it

CI / Jenkins:
  disabled intentionally
```

The Jenkinsfile currently sets `MX_AUTH_AUTO_RENEW=0`. This is deliberate: a normal Jenkins service agent cannot safely solve Samsung MFA/CAPTCHA in the background. When the saved session expires, refresh it through the approved local interactive flow and replace the Jenkins Secret files.

The pipeline must never manufacture PASS from an invalid session.

## Authenticated-safe Jenkins profile

Use the `authenticated-safe` TEST_SUITE before a full registered/destructive campaign.

It injects only the selected S1/S2 auth-state and session-storage credentials, runs the registered safe authentication scenarios with one worker and zero retries, and publishes a dedicated Playwright HTML report. It does **not** submit payment or create an order.

Recommended auth proof configuration:

```text
ENVIRONMENT     S2 (or S1)
TEST_SUITE      authenticated-safe
EXECUTION_MODE  safe
BROWSER_MODE    headless
```

A PASS proves that Jenkins can consume the stored Samsung session for the selected environment. A failure should be treated as an auth/session problem first; refresh the Secret files before attempting the full P1 campaign.

## Job configuration

Recommended job type: **Pipeline** or **Multibranch Pipeline** from SCM.

Repository:

```text
rodrigueslucas-lcs/samsung-order-automation
```

Script path:

```text
Jenkinsfile
```

For the current development cycle, use:

```text
agent/mx-qst-p1-finish
```

After integration, point the job to the team's permanent branch.

## Execution parameters

Use the Jenkins parameters exposed by the current `Jenkinsfile`.

- `fast-guest`: non-destructive 14-TC guest-safe feedback suite.
- `authenticated-safe`: registered-session proof without payment/order submission.
- `official-p1`: complete official 30-TC MX Base Store P1 campaign; requires authorized destructive mode.
- `backoffice-safe`: read-only BackOffice path.
- `allure-smoke`: reporting/plugin smoke validation.

Operational rules:

- select the intended MX environment explicitly;
- FAST and authenticated-safe execution do not require destructive authorization;
- the full official P1 campaign includes registered/destructive payment/order scenarios and requires explicit authorization;
- headless is recommended on Jenkins service agents;
- payment/order execution must not use blind automatic retries;
- video can remain opt-in until FFmpeg is proven stable on the real Jenkins agent.

For destructive execution, repository safety gates still apply, including environment guards and explicit action flags such as `ALLOW_PAYMENT_SUBMIT=1` where required by the runner. Do not enable destructive execution against Production.

## Pipeline stages

The Jenkins pipeline is organized for both operational readability and presentation. The current flow includes stages for:

1. Build Context
2. Checkout
3. Validate Request
4. Agent Health
5. Dependencies
6. Official Coverage Gate
7. Selected execution path: FAST Guest Safe / Authenticated Safe / BackOffice Safe / Official P1
8. Finalize Reports when applicable
9. Quality Summary
10. Declarative post actions / publication

Pipeline Stage View exposes this progression directly on the Jenkins job page.

## Official scope gate

Before test execution, the pipeline validates the current Samsung official priority model and runner selection.

For MX Base Store P1, the official runner must reconcile to **30 selected TCs** for either S1 or S2.

Static coverage/mapping and runtime PASS/FAIL remain separate concepts.

## Runtime and evidence

Runtime reconciliation preserves official statuses such as `PASS`, `FAIL`, `SKIPPED-BLOCKED` / `BLOCKED`, and `NOT_RUN`. Missing execution evidence is never inferred as PASS.

Playwright evidence can include screenshots, retained failure traces, video when enabled, context artifacts and business evidence metadata. Never archive `playwright/.auth/`.

## Published reports

### Executive Dashboard

The intended presentation flow is:

1. Build Health
2. Execution at a glance
3. Needs Attention only when required
4. Test Execution
5. MX Base Store P1 Automation Coverage
6. Official SMB Scope
7. Coverage by Feature + Gap Queue
8. Technical Governance, collapsed by default

`Technical Governance` contains the Historical Regional Validation Matrix, Data Integrity and Historical TC Archive.

### Allure

Technical drill-down for Samsung hierarchy, SAM/Jira IDs, business steps, runtime status, categories and attachments.

### Playwright report / trace

Deep technical investigation layer for Playwright execution details and trace analysis.

## HTML Publisher and Resource Root

Use Jenkins **HTML Publisher** links rather than opening archived HTML files as raw artifacts.

JS-heavy reports such as Playwright HTML may require Jenkins **Resource Root URL** to be configured to a different origin from the main Jenkins URL. This allows Jenkins to serve report resources without globally weakening Content Security Policy.

Do **not** disable Jenkins CSP globally just to make Playwright HTML render.

## Trace behavior from the Executive Dashboard

Directly sending an archived Jenkins `trace.zip` to public `trace.playwright.dev` is unreliable when Jenkins is hosted on `localhost` or another private origin. The public Trace Viewer may be unable to fetch that local URL because of browser Local Network Access, Jenkins authentication or cross-origin policy.

For that reason, the Executive Dashboard now treats the **published Playwright HTML report as the preferred trace entry point**. Trace evidence opens the Jenkins Playwright report rather than pretending that a public Trace Viewer URL will always be able to fetch `localhost`.

The raw ZIP remains archived for engineering recovery, but the presentation UX should use the published Playwright report. Error/context text is already surfaced inline in the dashboard failure reason instead of exposing a markdown artifact link that Jenkins may download.

## Allure publication

The repository generates Allure results/reporting through project tooling. The Jenkins Allure plugin may additionally provide native build-history/report integration.

If a pipeline reports that the `allure` DSL step is unavailable, verify that the installed Allure plugin is active in a **new clean build**. Do not assume a build resumed across a Jenkins restart proves the plugin configuration is invalid.

The generated Allure HTML remains a valid fallback publication layer when native plugin publication is unavailable.

## Clean-build checklist

1. Pull/build the latest branch revision.
2. Confirm the Jenkins agent can reach the selected Samsung environment on the required corporate network/VPN.
3. Confirm Node, npm, Git and Chrome in Agent Health.
4. Confirm the environment-specific Secret file credentials exist.
5. Run `authenticated-safe` for the target environment and prove the stored session.
6. Run a non-destructive FAST build when validating reporting/guest infrastructure.
7. Confirm the selected test count matches the intended campaign.
8. Confirm Executive Dashboard publication.
9. Confirm Allure publication and TC attachments.
10. Confirm Playwright HTML opens through HTML Publisher.
11. Only then run the authorized destructive/full P1 campaign if required.
12. After a possible payment/order submit, inspect evidence/order state before any manual rerun.

## Security and safety rules

- Never commit passwords, cookies, tokens, session storage, payment test data or Jenkins secret files.
- Never archive `playwright/.auth/`.
- Production is read-only.
- Payment/order scenarios use controlled execution and no blind retry after an ambiguous submit.
- MFA/CAPTCHA is never bypassed.
- A backend/environment defect remains a backend/environment defect; tests must not be weakened only to make the build green.

## Presentation flow

Recommended demo sequence:

```text
Executive Dashboard
  → current build health
  → TC evidence / SAM
  → Allure technical drill-down
  → Playwright report / trace when needed
  → Jenkins Stage View / automation pipeline
  → regional scalability and official scope
```

This keeps the presentation outcome-first while retaining full engineering evidence underneath.
