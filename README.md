# Samsung LATAM SMB QA Automation

Playwright-based QA automation, governance and CI reporting for Samsung LATAM SMB eCommerce on SAP Commerce/Hybris.

This repository is a **regional QA engineering platform**: official Samsung scope governance -> Playwright execution -> Jenkins -> Executive Dashboard -> Allure/evidence.

## Current official scope

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

`governance/smb-qst.json` is preserved historical Zephyr traceability, not the current denominator.

### Active MX Base Store P1

The historical MX Base Store source contains 30 P1 rows. `SAM-25006` is preserved as an audited exclusion because Samsung SMB QA clarified that the inherited PSE bank-payment path is Colombia-specific rather than a valid MX path.

The active MX Base Store runner therefore selects **29 TCs** on S1/STG or S2/STG2. Environment changes endpoints/configuration, not the active inventory.

## Proven MX S2 baseline

The last runtime-proven baseline before the architecture cutover is:

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

`SAM-25010` creates a guest order, requests and accepts OTP successfully, then the current BaseSite cannot resolve the newly created order. The automation intentionally preserves that product/environment defect.

The canonical-path refactor is **code-complete but requires one post-refactor Jenkins acceptance run** before compatibility mirrors are physically deleted.

## Repository navigation

Canonical engineer-facing structure:

```text
tests/
  markets/
    mx/
      qst/base-store/
      dst/base-store/
      dst/backoffice/
    pe/
    shared/
  legacy/
    pe-s2/

reporting/              Executive, evidence, PreQA2 and reporting integrity tests
governance/             official scope, mappings, runtime ledgers and governance tests
config/                 market/runtime configuration
fixtures/               compatibility test data; PE data namespaced under fixtures/pe
flows/                  reusable business/presentation flows
pages/                  Page Objects; responsibility decomposition is a later phase
scripts/                executable CLIs; responsibility decomposition follows MX acceptance
utils/                  runtime/governance helpers
```

Rule: **market -> suite -> store**. S1/S2 are runtime environments, not permanent test taxonomy.

Temporary compatibility mirrors still exist only as rollback/acceptance safety nets:

```text
tests/s1/**       -> tests/markets/**
tests/s2/pe       -> tests/legacy/pe-s2
reporters/        -> reporting/
test-mapping/     -> governance/
```

VS Code hides those compatibility roots by default. Active CI/runners now use canonical boundaries, and structural guards prevent regression back to the old paths. Mirror parity is also checked while the compatibility copies remain.

```bash
npm run repo:architecture:validate
npm run repo:legacy:audit
```

The old root `reporter-tests/` and `mapping-tests/` boundaries were removed and must not return.

Read `docs/REPOSITORY_AUDIT.md` before deleting compatibility or historical material.

## MX official runner

Full active MX Base Store P1:

```bash
npm run qst:mx:base-store
```

Discovery only:

```bash
npm run qst:mx:list
```

Jenkins supports targeted stabilization through `P1_TARGET_IDS`, for example:

```text
SAM-24969,SAM-24991,SAM-25002
```

Targeted execution uses the same guards, credentials and reporting stack while selecting only active official IDs.

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

CI uses pre-provisioned secret files. MFA/CAPTCHA is never bypassed.

## Payment-data boundary

`fixtures/card.json` is **not** the MX runtime test card. It remains a PE/DST compatibility dependency through `utils/testData.js`.

Active MX payment data is runtime-only:

```text
playwright/.auth/mx-test-card.json
```

Do not merge/delete those mechanisms until PE reconciliation proves the compatibility dependency is gone.

## Reporting model

The platform keeps four dimensions separate:

1. **Official scope** — current Samsung inventory.
2. **Current runtime** — what happened in this build.
3. **Implementation coverage** — what automation exists.
4. **Historical/governance evidence** — previous campaigns and ledgers.

Primary review surfaces are Executive Dashboard, Allure, Playwright trace/evidence and Jenkins orchestration. Coverage never implies PASS.

## Safety rules

Production is read-only. Never submit Production payments/orders, modify Production profile data, execute Production CronJobs/cancellations or use Production as fallback.

State-changing non-Production actions remain guarded:

```text
ALLOW_PAYMENT_SUBMIT=1
ALLOW_CRONJOB_RUN=1
ALLOW_PROFILE_WRITE=1
```

Ambiguous payment/order submission must never be blindly retried.

## Environments

MX environment parity:

- S1 -> `stg.shop.samsung.com`
- S2 -> `stg2.shop.samsung.com`

The same active test inventory is routed by runtime configuration.

## Local setup

```bash
npm ci
npx playwright install chromium
```

Useful gates:

```bash
npm run repo:architecture:validate
npm run repo:legacy:audit
npm run qst:official:gate
npm run qst:mx:list
npm run reporting:mx-runtime:test
npm run reporting:preqa2:test
```

## Architecture acceptance checkpoint

Before physically deleting compatibility mirrors, run the post-refactor MX S2 official P1 from Jenkins. The required acceptance contract is:

```text
29 selected
29 executed
0 architecture-induced BLOCKED/NOT_RUN
no new automation failures
```

`SAM-25010` may remain the single FAIL only while the already-proven Samsung Track Order defect continues to reproduce.

## Documentation

- `docs/README.md` — documentation index
- `docs/REPOSITORY_AUDIT.md` — refactor/cleanup contract and deletion gates
- `docs/CURRENT_ARCHITECTURE.md` — executable architecture
- `docs/OFFICIAL_SMB_PRIORITY_MODEL.md` — scope/priority source model
- `docs/ENVIRONMENT_VALIDATION_POLICY.md` — environment rules
- `docs/JENKINS_SETUP.md` — CI setup
- `docs/EXECUTIVE_REPORT_V3.md` — reporting model
