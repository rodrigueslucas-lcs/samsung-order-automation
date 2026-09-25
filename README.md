# Samsung LATAM SMB QA Automation

Playwright-based QA automation, governance and CI reporting for Samsung LATAM SMB eCommerce on SAP Commerce/Hybris.

This repository is a **regional QA engineering platform**, not a set of isolated scripts. It combines Samsung scope governance, Playwright execution, evidence, Jenkins CI, an Executive Dashboard and Allure investigation across Mexico, Peru, Chile and Colombia.

## Current official scope

The business source of truth is the Samsung priority-template model under `docs/smb_priority_templates/`.

Priority and execution context are independent:

- **P1 executes in QST + DST**;
- **P2 executes in DST only**;
- Base Store and EPP remain separate store contexts.

| Market | Base Store | EPP | P1 / QST | P2 | DST total |
| --- | ---: | ---: | ---: | ---: | ---: |
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

`test-mapping/smb-qst.json` is a preserved historical 144-ID Zephyr campaign. Its size happens to equal the current P1 total, but it is **not** the current P1/P2 denominator.

### Active MX Base Store P1

The official MX Base Store source contains 30 historical P1 rows, but `SAM-25006` is currently excluded from active MX execution because Samsung SMB QA clarified that the PSE bank-payment path in the copied test data is Colombia-specific and is not a valid MX payment path.

Therefore the active MX Base Store runner selects **29 TCs** on either S1/STG or S2/STG2. The exclusion remains preserved for audit; it is not silently deleted from scope history.

MX still has **38 P1 rows overall** when the 8 EPP P1 rows are included.

## Proven MX S2 baseline

The stabilized MX S2 official Base Store P1 baseline is:

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

`SAM-25010` creates a guest order, requests/accepts OTP successfully, then the current BaseSite cannot resolve the newly created order. That remains a product/environment defect until Samsung fixes the behavior; the automation must not be weakened to manufacture PASS.

## What the framework provides

- Playwright 1.60 / Node.js automation with Page Objects and reusable business flows.
- Official-scope governance for P1/P2, QST/DST and Base Store/EPP.
- Runtime reconciliation into PASS / FAIL / BLOCKED / NOT_RUN.
- Screenshots, traces, optional video and business evidence.
- Jenkins CI with guarded destructive execution and secret-file injection.
- Executive Dashboard for build health, scope, coverage and evidence.
- Allure for technical drilldown and TC-level investigation.
- Environment safety that prevents Production writes.
- Controlled authentication validation/recovery without bypassing MFA/CAPTCHA.

## Reporting model

The framework deliberately keeps four dimensions separate:

1. **Official scope** — current Samsung inventory.
2. **Current runtime** — what actually happened in this build.
3. **Implementation coverage** — what has automation implemented.
4. **Historical/governance evidence** — previous campaigns, ledgers and reconciliation.

Coverage never implies PASS, and missing runtime never becomes PASS.

### Executive Dashboard

Primary build-review entry point:

`test-results/jenkins/mx-qst/executive/index.html`

### Allure

Technical investigation hierarchy:

`Samsung SMB Automation -> <market> · <environment> · <store> -> <suite> · <feature> -> SAM-xxxxx`

Allure complements the Executive Dashboard; it does not replace the current runtime contract.

## MX official runner

Full active MX Base Store P1:

```bash
npm run qst:mx:base-store
```

Discovery only:

```bash
npm run qst:mx:list
```

Jenkins also supports targeted stabilization through `P1_TARGET_IDS`, for example:

```text
SAM-24969,SAM-24991,SAM-25002
```

Targeted execution uses the same official runner, credentials, guards and reporting stack but selects only active official MX IDs.

## Authentication

Runtime authentication artifacts live under ignored `playwright/.auth/` and must never be committed.

Primary MX login + verification:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:login:mx && MX_QST_ENVIRONMENT=S2 npm run auth:verify:mx
```

Second-account flow used by `SAM-24986`:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second MX_AUTH_MANUAL=1 node scripts/auth-login-mx.cjs && MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second npm run auth:verify:mx
```

CI uses pre-provisioned secret files. Interactive renewal is intentionally disabled in Jenkins unless explicitly enabled.

## Safety rules

Production is read-only.

Never submit Production payments/orders, modify Production profile data, execute Production CronJobs/cancellations or use Production as a fallback environment.

State-changing non-Production actions remain explicitly guarded:

```text
ALLOW_PAYMENT_SUBMIT=1
ALLOW_CRONJOB_RUN=1
ALLOW_PROFILE_WRITE=1
```

Ambiguous payment/order submission must never be blindly retried.

## Repository architecture

Executable tests are now organized by **ownership**, not by staging environment:

```text
tests/
├── markets/
│   ├── mx/
│   │   ├── qst/
│   │   └── dst/
│   └── pe/
│       ├── qst/
│       └── dst/
├── shared/
│   └── smb/qst/
└── legacy/
    └── pe/qst/

pages/                 Page Objects
flows/                 reusable business/presentation flows
config/                market/runtime configuration
scripts/               auth, CI, reporting and governance CLIs
reporters/             Executive, evidence, PreQA2 and reporting tests
test-mapping/          scope, mapping, runtime ledgers and governance tests
fixtures/               compatibility data; PE data is explicitly namespaced
```

The important rule is:

```text
market/store/suite = physical ownership
environment S1/S2   = runtime configuration
```

`tests/legacy/pe/qst` is intentionally explicit: it contains the older PE QST generation retained for reconciliation. New PE QST work belongs under `tests/markets/pe/qst`.

The next structural cleanup area is the still-flat `scripts/` / `pages/` ownership. See `docs/REPOSITORY_AUDIT.md` for the active migration contract.

## Important legacy compatibility

`fixtures/card.json` is **not** the MX runtime test card. It remains consumed by PE DST through `utils/testData.js`.

Active MX payment data comes from ignored runtime file:

`playwright/.auth/mx-test-card.json`

Do not delete the versioned card fixture until PE consolidation proves it is unused.

## Environments

MX supports environment-parity execution:

- S1 -> `stg.shop.samsung.com`
- S2 -> `stg2.shop.samsung.com`

The selected environment changes endpoints/configuration, not the physical test ownership or active MX Base Store TC inventory.

## Local setup

```bash
npm ci
npx playwright install chromium
```

Useful gates:

```bash
npm run repo:architecture:validate
npm run qst:official:gate
npm run qst:mx:list
npm run reporting:mx-runtime:test
npm run reporting:preqa2:test
```

## Documentation

Start here:

- `docs/README.md` — documentation index
- `docs/REPOSITORY_AUDIT.md` — cleanup/refactor contract
- `docs/CURRENT_ARCHITECTURE.md` — runtime/architecture model
- `docs/OFFICIAL_SMB_PRIORITY_MODEL.md` — priority/source model
- `docs/ENVIRONMENT_VALIDATION_POLICY.md` — environment rules
- `docs/JENKINS_SETUP.md` — CI setup
- `docs/EXECUTIVE_REPORT_V3.md` — reporting model
