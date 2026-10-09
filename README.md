# Samsung LATAM SMB QA Automation

Playwright-based QA automation for Samsung LATAM SMB eCommerce on SAP Commerce/Hybris.

This repository supports **MX, PE, CO and CL** and connects the official Samsung QST/DST scope to local execution, Jenkins, Executive Dashboard, Allure and Playwright evidence.

The goal of this README is operational: a QA who has never used the project should understand how to install it, authenticate with their own Samsung Account, run one market, run one TC and read the result.

## What this project does

The automation covers market-specific Base Store/QST flows and supporting BackOffice/payment/authentication scenarios. It is designed to answer four different questions without mixing them:

1. What is the official Samsung scope?
2. What is automated?
3. What happened in the current execution?
4. Is a failure new, known, blocked by environment/test data, or caused by automation?

The primary result surfaces are:

- **Executive Dashboard** — release/build health and business-oriented status.
- **Allure** — SAM/Jira-oriented technical drilldown, steps and attachments.
- **Playwright** — traces, screenshots, video and low-level investigation.
- **Jenkins** — controlled execution, credentials, gates and publication.

## Supported markets

| Market | Base Store runner | List scope | Authentication | Second account |
| --- | --- | --- | --- | --- |
| MX | `npm run qst:mx:base-store` | `npm run qst:mx:list` | `npm run auth:refresh:mx` | Required for specific scenarios |
| PE | `npm run qst:pe:base-store` | `npm run qst:pe:list` | `npm run auth:refresh:pe` | Not required in current Base Store P1 |
| CO | `npm run qst:co:base-store` | `npm run qst:co:list` | `npm run auth:refresh:co` | Required for specific scenarios |
| CL | `npm run qst:cl:base-store` | `npm run qst:cl:base-store:list` | `npm run auth:refresh:cl` | Supported by auth layer; not required in current Base Store P1 |

Use the list command before a campaign when you want to confirm the current active IDs/count. Do not rely on an old README count as the source of truth.

## First-time setup

Requirements:

- Node.js 24.x
- npm
- corporate/VPN/network access required by Samsung staging services
- Git access to the repository

Install:

```bash
npm ci
npx playwright install chromium
```

Then validate the repository:

```bash
npm run repo:architecture:validate
npm run qst:official:gate
npm run qst:steps:gate
```

## The authentication model in plain language

The **code is shared**, but the **identity used by the tests is local/private**.

A new QA does not edit TCs to replace another person's email. Instead:

1. the QA runs the refresh command for a market;
2. a dedicated Chrome session is opened;
3. the QA signs in with their own Samsung Account;
4. CAPTCHA/MFA is completed manually if Samsung requests it;
5. the automation captures the authenticated browser state;
6. the state is saved locally under `playwright/.auth/`;
7. the state is verified;
8. a CI handoff bundle is generated under `playwright/.session-packages/`.

Those directories are ignored by Git. Passwords, cookies and session material must never be committed.

### Manual login — recommended onboarding path

Use manual auth when another QA is configuring the project for the first time.

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
CL_QST_ENVIRONMENT=S2 CL_AUTH_MANUAL=1 npm run auth:refresh:cl
```

The operator follows the visible browser and completes Samsung Account login/CAPTCHA/MFA if requested. The command only finishes successfully after the resulting session is verified and packaged.

### What `auth:refresh` actually does

Conceptually:

```text
open dedicated browser
        ↓
Samsung Account login
        ↓
CAPTCHA / MFA when requested
        ↓
return authenticated to storefront
        ↓
save browser session locally
        ↓
verify session
        ↓
generate Jenkins session bundle
```

It does **not** bypass CAPTCHA/MFA and it does **not** make a short-lived Samsung session permanent.

## Second-account authentication

Some business scenarios require two independent users.

Current operational requirement:

```text
MX -> second account used by specific QST scenarios
CO -> second account used by specific QST scenarios
PE -> no second account required for current Base Store P1
CL -> auth layer supports it, but current Base Store P1 does not require it
```

Refresh the second account explicitly:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second MX_AUTH_MANUAL=1 npm run auth:refresh:mx
CO_QST_ENVIRONMENT=S2 CO_AUTH_SLOT=second CO_AUTH_MANUAL=1 npm run auth:refresh:co
```

Primary and second sessions must represent different users where the business TC expects user isolation.

## Running a market locally

Examples for S2:

```bash
MX_QST_ENVIRONMENT=S2 npm run qst:mx:base-store
PE_QST_ENVIRONMENT=S2 npm run qst:pe:base-store
CO_QST_ENVIRONMENT=S2 npm run qst:co:base-store
CL_QST_ENVIRONMENT=S2 npm run qst:cl:base-store
```

The recommended operating model is **one market campaign at a time**. Market sessions, test data, payment/order side effects and auth lifetime are isolated operational concerns; do not assume that four full authenticated campaigns should be started together just because Playwright can parallelize processes.

## Running only one TC

Target execution is the safest way to stabilize or investigate a specific case before a full campaign.

Examples:

```bash
PE_QST_ENVIRONMENT=S2 PE_QST_TARGET_IDS=SAM-25103 npm run qst:pe:base-store
```

MX/CO/CL runners also support their market target mechanism used by Jenkins. Confirm the current runner/env variable before scripting a new workflow.

## Jenkins session handoff

Local auth and Jenkins auth are separate responsibilities.

The local `auth:refresh:<market>` command creates a verified session bundle. A publisher command then uploads that bundle into the protected Jenkins credential used by the pipeline.

Current market-specific publishers:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:mx
PE_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:pe
CO_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:co
```

Publishing requires local Jenkins API configuration (`JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`). The session content must not be printed or committed.

CL already supports refresh/package/install, but a market-specific `auth:publish:jenkins:cl` command is still a handoff-standardization gap and should be treated as pending until implemented and runtime-proven.

Some refresh scripts can publish automatically when `JENKINS_AUTH_PUBLISH=1` is explicitly enabled. For onboarding, keep refresh and publish as two visible steps until the operator understands the lifecycle.

## Session lifetime and CAPTCHA

A successful authentication is reusable, not permanent.

Samsung Account/session state can expire or rotate. The project therefore uses **preflight verification** rather than assuming a session is good because a file exists.

CAPTCHA/MFA is a human security gate. The automation intentionally does not attempt to bypass it.

A good explanation for stakeholders is:

> Human intervention is required only when Samsung Account explicitly requests identity verification. After a valid session is captured and verified, the Jenkins test execution itself is automated.

## Known defects vs automation failures

A known product/environment defect should not be disguised as a new automation regression.

The reporting model is evolving toward explicit categories such as:

- PASS
- FAIL / unexpected regression
- BLOCKED / environment or test-data dependency
- KNOWN BUG / defect already registered and tracked
- NOT_RUN

When a known defect is intentionally quarantined, the automation must match the known causal signature narrowly. Unrelated errors must still fail.

## Safety rules

Production is read-only.

Never:

- submit Production payments/orders;
- modify Production profile data;
- run destructive Production BackOffice/CronJob actions;
- use Production as a fallback when staging is unavailable;
- blindly retry an ambiguous payment/order submission;
- commit auth/session/payment secrets.

State-changing non-Production actions remain guarded by explicit runtime flags such as:

```text
ALLOW_PAYMENT_SUBMIT=1
ALLOW_CRONJOB_RUN=1
ALLOW_PROFILE_WRITE=1
```

## Repository structure

```text
tests/markets/       Current market-owned automation
pages/               Page Objects
flows/               Shared/reusable business flows
config/              Market/runtime configuration
scripts/             Auth, runners, gates and operational CLIs
utils/               Shared runtime/governance helpers
governance/          Official scope, mappings and runtime ledgers
reporting/           Executive/Allure/evidence/reporting stack
docs/                Detailed guides and engineering contracts
```

Rule: **market -> suite -> store**. Environment (S1/S2) is runtime configuration, not the primary source-tree taxonomy.

## Handoff-ready workflow

A new QA should be able to follow this path without editing source code:

```text
1. clone repository
2. npm ci
3. install Playwright Chromium
4. connect VPN/network
5. choose market/environment
6. run auth:refresh:<market> in manual mode
7. complete Samsung login/CAPTCHA/MFA if requested
8. run market list command
9. run a single safe/target TC
10. run the full intended market campaign
11. review Executive Dashboard / Allure / Playwright evidence
```

If this cannot be completed without tribal knowledge, treat it as a documentation/tooling defect.

## Documentation

Start here, then use detailed guides only when needed:

- [`docs/HANDOFF_GUIDE.md`](docs/HANDOFF_GUIDE.md) — first-use and ownership transfer checklist.
- [`docs/AUTHENTICATION_GUIDE.md`](docs/AUTHENTICATION_GUIDE.md) — primary/second auth, session files and Jenkins handoff.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — common auth, environment, Jenkins and Playwright failures.
- [`docs/JENKINS_SETUP.md`](docs/JENKINS_SETUP.md) — Jenkins engineering configuration.
- [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md) — architecture details.
- [`docs/OFFICIAL_SMB_PRIORITY_MODEL.md`](docs/OFFICIAL_SMB_PRIORITY_MODEL.md) — official priority/scope model.
- [`docs/EXECUTIVE_REPORT_V3.md`](docs/EXECUTIVE_REPORT_V3.md) — reporting contract.
- [`docs/README.md`](docs/README.md) — complete documentation index.

## Documentation policy

There should be **one primary README at repository root**. It is the user/operator entry point.

Additional files should exist only when they have a distinct responsibility. Prefer descriptive names such as `AUTHENTICATION_GUIDE.md` or `TROUBLESHOOTING.md` instead of creating many generic `README.md` files.

Folder-level READMEs are acceptable only when a folder has a specific ownership/compatibility contract that developers need while working inside that folder. They must not compete with this root README as the onboarding source of truth.
