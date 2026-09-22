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

Use Jenkins **Secret file** credentials for the environment-specific auth material and approved payment test data expected by the job configuration. The pipeline copies secret files into the gitignored `playwright/.auth/` directory only for the build and removes that directory in `post { always { ... } }` before artifact publication.

Generate or refresh MX auth state through the approved local flow:

```bash
npm run auth:login:mx
```

Do not manually edit cookies and do not bypass MFA/CAPTCHA.

## Authentication behavior

Registered-user tests validate the persisted MX session before continuing.

For a recoverable auth failure such as:

- expired Samsung Account session;
- unusable saved access/auth state;
- expired setup cookie;

the authenticated fixture can perform **one controlled renewal**, then reload the new cookies/local/session storage into the already-running Playwright context and prove authentication again before the TC continues.

Auto-renew policy:

```text
Local execution:
  enabled by default
  MX_AUTH_AUTO_RENEW=0 disables it

CI / Jenkins:
  disabled by default
  MX_AUTH_AUTO_RENEW=1 explicitly enables it
```

Enable CI auto-renew only on an agent where interactive Samsung Account verification can be completed safely. MFA/CAPTCHA remains a human verification step and is never bypassed.

If renewal cannot complete, the run remains failed/blocked. The pipeline must never manufacture PASS from an invalid session.

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

Use the Jenkins parameters exposed by the current `Jenkinsfile`. The important operational rules remain:

- select the intended MX environment explicitly;
- FAST/guest-safe execution must not require destructive authorization;
- the full official P1 campaign includes registered/destructive payment/order scenarios and requires explicit authorization;
- headless is recommended on Jenkins service agents;
- payment/order execution must not use blind automatic retries;
- video can remain opt-in until FFmpeg is proven stable on the real Jenkins agent.

For destructive execution, the repository safety gates still apply, including environment guards and explicit action flags such as:

```text
ALLOW_PAYMENT_SUBMIT=1
```

Do not enable destructive execution against Production.

## Pipeline stages

The Jenkins pipeline is organized for both operational readability and presentation. The current flow includes stages for:

1. Build Context
2. Checkout
3. Validate Request
4. Agent Health
5. Dependencies
6. Official Coverage Gate
7. Selected execution path, such as FAST Guest Safe / BackOffice Safe / Official P1
8. Finalize Reports
9. Quality Summary
10. Declarative post actions / publication

Pipeline Stage View exposes this progression directly on the Jenkins job page.

## Official scope gate

Before test execution, the pipeline validates the current Samsung official priority model and runner selection.

For MX Base Store P1, the official runner must reconcile to **30 selected TCs** for either S1 or S2.

Static coverage/mapping and runtime PASS/FAIL remain separate concepts.

## Runtime and evidence

The pipeline writes the current build result under the Jenkins test-results tree, including the machine-readable runtime summary used by the reports.

Runtime reconciliation preserves official statuses such as:

- `PASS`
- `FAIL`
- `SKIPPED-BLOCKED` / `BLOCKED`
- `NOT_RUN`

Missing execution evidence is never inferred as PASS.

Playwright evidence can include:

- screenshots;
- retained failure traces;
- video when enabled;
- error/context artifacts;
- business evidence metadata.

Never archive `playwright/.auth/`.

## Published reports

The Jenkins reporting stack has three complementary layers:

### Executive Dashboard

Published from the Jenkins MX QST report output and intended as the first presentation/release view.

The final dashboard flow is:

1. Build Health
2. Execution at a glance
3. Needs Attention only when required
4. Test Execution
5. MX Automation Coverage
6. Official SMB Scope
7. Coverage by Feature + Gap Queue
8. Technical Governance, collapsed by default

`Technical Governance` contains:

- Regional Validation Matrix
- Data Integrity
- Historical TC Inventory

### Allure

Technical drill-down for Samsung hierarchy, SAM/Jira IDs, business steps, runtime status, categories and attachments.

### Playwright report / trace

Deep technical investigation layer for Playwright execution details and trace analysis.

## HTML Publisher and Resource Root

Use Jenkins **HTML Publisher** links rather than opening archived HTML files as raw artifacts.

JS-heavy reports such as Playwright HTML may require Jenkins **Resource Root URL** to be configured to a different origin from the main Jenkins URL. This allows Jenkins to serve report resources without globally weakening Content Security Policy.

Do **not** disable Jenkins CSP globally just to make Playwright HTML render.

## Playwright Trace Viewer from Jenkins

The Executive Dashboard and Allure may link a trace to:

```text
https://trace.playwright.dev/?trace=<archived-jenkins-trace-url>
```

For this to work:

- the archived trace URL must be reachable from the browser;
- Jenkins authentication/CORS policy must permit access;
- the browser must permit the public Trace Viewer origin to reach the Jenkins artifact origin.

When Jenkins runs on `localhost`, Chromium-based browsers may block that cross-origin local fetch until **Local Network Access** is allowed for `trace.playwright.dev`.

A Trace Viewer access error does not by itself mean the trace ZIP is corrupt.

## Allure publication

The repository already generates Allure results/reporting through project tooling. The Jenkins Allure plugin may additionally provide native build-history/report integration.

If a pipeline reports that the `allure` DSL step is unavailable, verify that the installed Allure plugin is active in a **new clean build**. Do not assume a build resumed across a Jenkins restart proves the plugin configuration is invalid.

The generated Allure HTML remains a valid fallback publication layer when native plugin publication is unavailable.

## First-run / clean-build checklist

1. Confirm the Jenkins agent can reach the selected Samsung environment on the required corporate network/VPN.
2. Confirm Node, npm, Git and Chrome in Agent Health/Diagnostics.
3. Confirm the required Secret file credentials exist for the selected environment.
4. Run the official coverage/inventory gate.
5. Run a non-destructive FAST build first when validating infrastructure/reporting.
6. Confirm the selected test count matches the intended campaign.
7. Confirm Executive Dashboard publication.
8. Confirm Allure publication and TC attachments.
9. Confirm Playwright HTML opens through HTML Publisher.
10. Open one retained trace and validate browser/Jenkins network permissions.
11. Only then run the authorized destructive/full campaign if required.
12. After a possible payment/order submit, inspect evidence/order state before any manual rerun.

## Security and safety rules

- Never commit passwords, cookies, tokens, session storage, payment test data or Jenkins secret files.
- Never archive `playwright/.auth/`.
- Production is read-only.
- Payment/order scenarios use controlled execution and no blind retry after an ambiguous submit.
- `ALLOW_PAYMENT_SUBMIT`, profile-write and cronjob flags authorize only their explicit non-Production action families.
- MFA/CAPTCHA is never bypassed.
- Auth renewal is attempted at most once per recoverable fixture setup failure.
- A backend/environment defect remains a backend/environment defect; tests must not be weakened only to make the build green.

## Presentation flow

Recommended demo sequence:

```text
Executive Dashboard
  → current build health
  → TC evidence / SAM
  → Allure technical drill-down
  → Playwright trace when needed
  → Jenkins Stage View / automation pipeline
  → regional scalability and official scope
```

This keeps the presentation outcome-first while retaining full engineering evidence underneath.
