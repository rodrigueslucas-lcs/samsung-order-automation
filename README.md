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

For the active MX Base Store campaign, the official runner selects **the same 30 Base Store P1 TCs on S1/STG or S2/STG2**. Environment selection changes configuration, not the TC inventory. MX has **38 P1 rows overall** when its 8 EPP P1 rows are included.

See [Official SMB Priority Model](docs/OFFICIAL_SMB_PRIORITY_MODEL.md).

## What the framework provides

- **Playwright 1.60 / Node.js** automation with Page Objects and reusable business flows.
- **Official-scope governance** with P1/P2, QST/DST and Base Store/EPP kept independent.
- **Runtime reconciliation** so Playwright output is translated into official PASS / FAIL / BLOCKED / NOT_RUN without treating implementation coverage as execution.
- **Evidence capture** for screenshots, traces, videos and business evidence.
- **Jenkins CI** with guarded destructive execution, secret-file injection and archived reports.
- **Executive Dashboard** for presentation, release health, scope, coverage and evidence.
- **Allure** for technical drilldown, failure categories and TC-level investigation.
- **Environment safety** that blocks Production writes and prevents blind retries after payment/order submission.
- **Controlled MX auth recovery** for recoverable expired sessions, with CI auto-renew explicitly opt-in.

## Reporting model

The reporting stack deliberately separates four questions:

1. **What is the current official scope?** — 362 DST rows: 144 P1/QST + 218 P2.
2. **What ran in this build?** — the runtime summary for the selected campaign, e.g. the 30 MX Base Store P1 TCs.
3. **What is implemented?** — automation coverage/mapping, independent from PASS/FAIL.
4. **What happened technically?** — evidence, trace, screenshot, video, error and blocker classification.

### Executive Dashboard

The Executive Dashboard is the official entry point for demos and build review:

`test-results/jenkins/mx-qst/executive/index.html`

The presentation order is intentionally executive-first:

1. **QA Execution Dashboard / Build Health**
2. **Execution at a glance**
3. **Needs Attention** — rendered only when FAIL/BLOCKED exists
4. **Test Execution** — current TC-level runtime and evidence
5. **MX Automation Coverage** — implementation maturity, separate from execution
6. **Official SMB Scope** — compact 362 / 144 / 218 / current-runner reference
7. **Coverage by Feature + Automation Gap Queue**
8. **Technical Governance** — collapsed by default
   - Regional Validation Matrix
   - Data Integrity
   - Historical TC Inventory

The dashboard intentionally keeps historical/governance detail behind drill-down so the default view stays presentation-ready without removing traceability.

Evidence links are designed for browser-first investigation:

- **Screenshot** opens the image artifact.
- **Video** opens the video artifact.
- **Open Trace** launches Playwright Trace Viewer with the archived trace URL.
- **Error Context** opens the supporting artifact.

The Jenkins artifact must remain reachable by the browser for Trace Viewer to load it. Jenkins authentication, CORS and browser network policy can restrict remote Trace Viewer access. When Jenkins is served from `localhost`, Chromium-based browsers may additionally require **Local Network Access** permission for `trace.playwright.dev` before the remote viewer can fetch the archived trace.

### Allure

Allure complements the Executive Dashboard rather than replacing it. It is the technical investigation view with Samsung business hierarchy, SAM IDs, runtime status, blocker categories, environment/build metadata and attachments.

The intended hierarchy is:

`Samsung SMB Automation → MX · <environment> · Base Store → P1/QST · <feature> → SAM-xxxxx`

Jenkins publishes:

- `MX QST Executive Dashboard`
- `Samsung MX QST - Allure`
- `Playwright MX QST`
- optional `Allure Reporting Smoke`

## MX S1 / S2 Base Store runner

The official MX Base Store command is:

```bash
npm run qst:mx:base-store
```

Discovery only:

```bash
npm run qst:mx:list
```

The runner uses one worker and zero retries for the controlled campaign. Payment/order scenarios are guarded and must only run in an explicitly authorized non-Production environment.

Registered-user execution uses environment-specific storefront state (`mx-s1-*` or `mx-s2-*`). Authentication/backend instability is classified as an environment/authentication blocker; it must not be disguised as an automation PASS or silently bypassed.

## Authentication

MX storefront authentication artifacts are local/runtime-only under `playwright/.auth/` and must never be committed. The approved operator workflow for creating or manually refreshing the MX login is:

```bash
npm run auth:login:mx
```

The authenticated fixture validates the saved session before registered-user execution. For recoverable failures such as an expired session, unusable auth state or expired setup cookie, it can perform **one controlled renewal**, reload the freshly persisted browser state into the already-running Playwright context, validate authentication again and then continue the TC.

Auto-renew policy:

- **Local:** enabled by default unless `MX_AUTH_AUTO_RENEW=0`.
- **CI/Jenkins:** disabled by default; enable only with `MX_AUTH_AUTO_RENEW=1` where interactive Samsung Account verification can be completed safely.
- **MFA/CAPTCHA:** never bypassed; if presented, they remain human verification steps in the dedicated Chrome login flow.

A failed renewal remains a failure/blocker. The framework never converts an unverified session into PASS.

Credentials, cookies, tokens and storage state must never be logged or committed.

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

MX QST supports environment-parity execution: **S1 uses `stg.shop.samsung.com` and S1 BackOffice; S2 uses `stg2.shop.samsung.com` and S2 BackOffice**. The same MX Base Store P1 inventory is reused across both environments so results can be compared TC-for-TC without duplicating specs. The repository already uses STG2/S2 for the established PE automation, including `tests/s2/pe/qst` and `tests/s2/pe/dst`.

Environment applicability is determined by the real business flow, not by forcing every TC into one host. In MX, storefront/catalog scenarios can also be validated in PreQA2 where supported, while Cart/Checkout/Orders/Payment/BackOffice flows are routed to the selected Staging environment.

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

`Executive Dashboard → current build health → TC evidence → Allure drilldown → Jenkins pipeline/stages → regional scalability`

The dashboard is the executive entry point; Allure and Playwright remain the technical investigation layers. Jenkins demonstrates how those outputs are produced automatically. This keeps the presentation concise while preserving full engineering evidence underneath.

## Documentation

- [Current SMB Architecture](docs/CURRENT_ARCHITECTURE.md)
- [Official SMB Priority Model](docs/OFFICIAL_SMB_PRIORITY_MODEL.md)
- [Environment Validation Policy](docs/ENVIRONMENT_VALIDATION_POLICY.md)
- [MX QST Coverage](docs/MX_QST_COVERAGE_MATRIX.md)
- [Executive Report V3](docs/EXECUTIVE_REPORT_V3.md)
- [Jenkins Setup](docs/JENKINS_SETUP.md)
- [Documentation index](docs/README.md)
