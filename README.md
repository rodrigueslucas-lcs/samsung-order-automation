# Samsung LATAM SMB QA Automation

Regional QA engineering platform for Samsung LATAM SMB eCommerce on SAP Commerce/Hybris, combining Playwright execution, scope governance, Jenkins CI, evidence, Executive Dashboard and Allure.

## Official scope

| Market | Base Store | EPP | P1 / QST | P2 | DST total |
| --- | ---: | ---: | ---: | ---: | ---: |
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

P1 executes in QST + DST. P2 executes in DST only. Base Store and EPP remain separate store contexts.

The MX Base Store source has 30 historical P1 rows, but `SAM-25006` is preserved as an audit exclusion because the inherited PSE path is Colombia-specific and not a valid MX payment path. The active MX Base Store runner therefore selects **29 TCs**.

## Proven MX S2 baseline

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

`SAM-25010` creates a guest order, receives/accepts OTP, then the current BaseSite cannot resolve the newly created order. Keep this as a real functional/environment failure until Samsung fixes it.

## Repository architecture

Tests are now physically organized by ownership rather than environment:

```text
tests/
  markets/
    mx/
      qst/
      dst/
    pe/
      qst/
      dst/
  shared/
    smb/
      qst/
  legacy/
    pe/
      qst/
```

Environment (`S1` / `S2`) is runtime configuration. Do not recreate environment-owned test trees.

Canonical paths are centralized in `config/testPaths.cjs` and guarded by `mapping-tests/marketFirstPaths.test.cjs` so executable contracts cannot silently reintroduce `tests/s1` or `tests/s2`.

### Ownership

- `tests/markets/mx/qst/base-store` — active MX QST / 29-TC Base Store P1 implementation.
- `tests/markets/mx/dst` — MX DST plus current MX auth/flow helpers reused by QST.
- `tests/markets/pe/qst` — current regional PE QST stabilization implementation.
- `tests/markets/pe/dst` — established PE DST implementation.
- `tests/shared/smb/qst` — explicitly shared/regional candidates.
- `tests/legacy/pe/qst` — older PE/ST2 QST generation kept behind explicit legacy entry points until reconciliation is complete.

Other architecture boundaries are still being consolidated deliberately:

```text
pages/          Page Objects
flows/          reusable business flows
utils/          runtime + governance helpers
scripts/        auth, CI, reporting and governance CLIs
reporters/      Executive / evidence / PreQA2 reporting
test-mapping/   scope, mapping and runtime ledgers
mapping-tests/  governance integrity tests
reporter-tests/ reporting integrity tests
```

Reporting/governance physical consolidation is a later phase because these paths are referenced by CI and integrity tests. Do not move them cosmetically without changing every consumer atomically.

## MX official runner

```bash
npm run qst:mx:base-store
```

Discovery only:

```bash
npm run qst:mx:list
```

Jenkins targeted stabilization:

```text
P1_TARGET_IDS=SAM-24969,SAM-24991,SAM-25002
```

The targeted lane uses the same official runner, credentials, guards and reporting stack; it does not redefine official scope.

## PE execution generations

Current regional PE P1:

```bash
npm run qst:pe:p1
```

Older PE/ST2 QST is isolated under explicit compatibility aliases:

```text
qst:pe:legacy:normal
qst:pe:legacy:modified
qst:pe:legacy:sanity
qst:pe:legacy:base-store
qst:pe:legacy:epp
```

The old generic `qst:normal`, `qst:modified`, etc. remain temporary aliases only while compatibility consumers are reconciled.

## Authentication

Runtime auth artifacts live under ignored `playwright/.auth/` and must never be committed.

Primary MX S2:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:login:mx && MX_QST_ENVIRONMENT=S2 npm run auth:verify:mx
```

Second account for `SAM-24986`:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second MX_AUTH_MANUAL=1 node scripts/auth-login-mx.cjs && MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second npm run auth:verify:mx
```

For Jenkins: refresh + verify locally, upload the fresh secret files, then run P1 directly. Do not insert an AUTH SAFE execution between upload and P1 unless diagnosing auth specifically.

## Payment data boundary

`fixtures/card.json` is PE compatibility data consumed through `utils/testData.js`.

Active MX payment data comes from ignored runtime file:

```text
playwright/.auth/mx-test-card.json
```

injected by Jenkins credential `samsung-mx-test-card`.

Do not merge these mechanisms until PE payment-data migration is complete.

## Reporting

The framework keeps these dimensions separate:

1. official scope;
2. current runtime result;
3. implementation coverage;
4. historical/governance evidence.

Primary review surfaces:

- Executive Dashboard — build/release health;
- Allure — SAM/Jira technical drilldown and attachments;
- Playwright/Trace — low-level investigation;
- Jenkins — orchestration, credentials and publication.

## Safety

Production is read-only. Never use Production as fallback or submit Production payments/orders/profile mutations/CronJobs.

Non-Production destructive actions stay explicitly guarded, including payment/order and profile writes. Do not blindly retry an ambiguous order/payment submission.

## Local setup and gates

```bash
npm ci
npx playwright install chromium
npm run qst:official:gate
npm run qst:mx:list
npm run reporting:mx-runtime:test
npm run preqa2:validation:test
```

## Documentation

- `docs/README.md` — documentation index
- `docs/REPOSITORY_AUDIT.md` — cleanup/refactor decisions
- `docs/CURRENT_ARCHITECTURE.md` — architecture/runtime model
- `docs/OFFICIAL_SMB_PRIORITY_MODEL.md` — official source model
- `docs/JENKINS_SETUP.md` — CI/credentials
- `docs/MX_QST_COVERAGE_MATRIX.md` — active MX scope
