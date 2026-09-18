# Samsung LATAM SMB QA Automation

Playwright-based QA automation and governance for Samsung LATAM SMB eCommerce on SAP Commerce/Hybris.

The project is designed as a **regional QA automation platform**, not a collection of isolated scripts. It combines official Samsung scope, safe Playwright execution, runtime reconciliation, evidence, Jenkins CI, an executive dashboard and Allure investigation across **Mexico, Peru, Chile and Colombia**.

## Current official scope

The current source of truth is the Samsung priority-template model imported from `docs/smb_priority_templates/`. Priority and store context are independent: **P1 runs in QST + DST; P2 runs in DST only**.

| Market | Base Store | EPP | P1 / QST | P2 | DST total |
| --- | ---: | ---: | ---: | ---: | ---: |
| MX | 56 (30 P1 / 26 P2) | 36 (8 / 28) | 38 | 54 | 92 |
| PE | 55 (28 / 27) | 37 (6 / 31) | 34 | 58 | 92 |
| CL | 53 (31 / 22) | 36 (7 / 29) | 38 | 51 | 89 |
| CO | 54 (28 / 26) | 35 (6 / 29) | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

The older `test-mapping/smb-qst.json` is a preserved **144-ID Zephyr execution campaign from 2026-09-02**. It remains useful for traceability and historical evidence, but it is **not** the current P1/P2 denominator. Its total happens to equal the current P1 total; the two models must not be conflated.

For the active MX S1 Base Store campaign, the official safe runner currently selects **30 Base Store P1 TCs**. MX has **38 P1 rows overall** when its 8 EPP P1 rows are included.

See [Official SMB Priority Model](docs/OFFICIAL_SMB_PRIORITY_MODEL.md).

## What the framework provides

- **Playwright 1.60 / Node.js** automation with Page Objects and reusable business flows.
- **Official-scope governance** with P1/P2, QST/DST and Base Store/EPP kept independent.
- **Runtime reconciliation** so Playwright output is translated into official PASS / FAIL / BLOCKED / NOT_RUN without treating implementation coverage as execution.
- **Evidence capture** for screenshots, traces, videos and business evidence.
- **Jenkins CI** with guarded destructive execution, secret-file injection and archived reports.
- **Executive Dashboard** for presentation, release health, scope and evidence.
- **Allure** for technical drilldown, failure categories and TC-level investigation.
- **Environment safety** that blocks Production writes and prevents blind retries after payment/order submission.

## Reporting model

The reporting stack deliberately separates four questions:

1. **What is the current official scope?** — 362 DST rows: 144 P1/QST + 218 P2.
2. **What ran in this build?** — the runtime summary for the selected campaign, e.g. the 30 MX S1 Base Store P1 TCs.
3. **What is implemented?** — automation coverage/mapping, independent from PASS/FAIL.
4. **What happened technically?** — evidence, trace, screenshot, video, error and blocker classification.

### Executive Dashboard

The Executive Dashboard is the official entry point for demos and build review:

`test-results/jenkins/mx-qst/executive/index.html`

Its first view is intentionally compact: build/environment/scope, execution KPIs, result distribution and items requiring attention. Detailed coverage, regional matrix, data audit and historical inventory are collapsible so the report remains useful without becoming visually overwhelming.

Evidence links are designed for browser-first investigation:

- **Screenshot** opens the image artifact.
- **Video** opens the video artifact.
- **Open Trace** launches Playwright Trace Viewer with the archived trace URL.
- **Error Context** opens the supporting artifact.

The Jenkins artifact must remain reachable by the browser for Trace Viewer to load it; Jenkins authentication/CORS/network policy can still restrict remote Trace Viewer access.

### Allure

Allure complements the Executive Dashboard rather than replacing it. It is the technical investigation view with Samsung business hierarchy, SAM IDs, runtime status, blocker categories, environment/build metadata and attachments.

Jenkins publishes:

- `MX QST Executive Dashboard`
- `Samsung MX QST - Allure`
- `Playwright MX QST`
- optional `Allure Reporting Smoke`

## MX S1 Base Store runner

The official MX Base Store command is:

```bash
npm run qst:mx:base-store
```

Discovery only:

```bash
npm run qst:mx:list
```

The runner uses one worker and zero retries for the controlled campaign. Payment/order scenarios are guarded and must only run in an explicitly authorized non-Production environment.

The current registered-user S1 flow depends on a valid Samsung Account storefront session. Authentication/backend instability is classified as an environment/authentication blocker; it must not be disguised as an automation PASS or silently bypassed.

## Authentication

MX storefront authentication artifacts are local/runtime-only under `playwright/.auth/` and must never be committed. The current operator workflow for refreshing the MX login is:

```bash
npm run auth:login:mx
```

MFA, CAPTCHA and other human-only challenges remain manual. Credentials, cookies, tokens and storage state must never be logged or committed.

## Safety rules

Production is **read-only**. Never submit Production orders/payments, execute Production CronJobs/cancellations, modify Production customer/profile data or follow an environment redirect into Production to complete a test.

State-changing non-Production actions remain explicitly guarded:

```text
ALLOW_PAYMENT_SUBMIT=1
ALLOW_CRONJOB_RUN=1
ALLOW_PROFILE_WRITE=1
```

Payment/order execution uses one worker and zero retries. An ambiguous submit must never be blindly retried.

## Repository architecture

```text
docs/smb_priority_templates/              current Samsung P1/P2 source templates
test-mapping/official-smb-inventory.json  current official inventory contract
test-mapping/smb-qst.json                 preserved 144-ID historical campaign
test-mapping/*-qst-*                      market mappings / reuse / runtime ledgers

tests/<environment>/<market>/             executable Playwright automation
pages/                                    Page Objects
utils/                                    guards, auth, evidence and shared flows
scripts/                                  runners, reconciliation and reporting

reporters/executive-v3/                   executive presentation/reporting
reporters/evidence/                       evidence model
reporters/preqa2/                         PreQA2 campaign reporting
reporter-tests/                           reporting integrity tests

Jenkinsfile                               CI orchestration and report publication
```

## Environments

Environment applicability is determined by the real business flow, not by forcing every TC into one host. In MX, storefront/catalog scenarios can be validated in PreQA2 where supported, while Cart/Checkout/Orders/Payment/BackOffice flows are routed to the applicable Staging environment.

A scenario that is not applicable in PreQA2 creates a Staging validation obligation; it does not become an automatic PASS. Production is never used as a fallback validation target.

## Local setup

```bash
npm ci
npx playwright install
```

Useful validation/reporting commands:

```bash
npm run qst:official:gate
npm run qst:mx:list
npm run reporting:mx-runtime:test
npm run reporting:mx:preview
npm run reporting:preqa2:test
```

Allure tooling can be installed without changing the lockfile:

```bash
npm run reporting:allure:install
```

## Presentation flow

For a team demo, the intended story is:

`Official Samsung scope → Jenkins execution → Executive Dashboard → evidence/trace → Allure drilldown → regional scalability`

The dashboard is the executive entry point; Allure and Playwright remain the technical investigation layers. This keeps the presentation concise while preserving full engineering evidence underneath.

## Documentation

- [Current SMB Architecture](docs/CURRENT_ARCHITECTURE.md)
- [Official SMB Priority Model](docs/OFFICIAL_SMB_PRIORITY_MODEL.md)
- [Environment Validation Policy](docs/ENVIRONMENT_VALIDATION_POLICY.md)
- [MX QST Coverage](docs/MX_QST_COVERAGE_MATRIX.md)
- [Executive Report V3](docs/EXECUTIVE_REPORT_V3.md)
- [Documentation index](docs/README.md)
