# Current SMB QA Automation Architecture

This document describes the **current executable architecture** and the **target physical architecture**. The repository is in a controlled migration: runtime behavior is stabilized, but test paths still expose historical S1/S2 organization.

## 1. Authoritative business scope

The business source of truth is the Samsung priority-template model under `docs/smb_priority_templates/`, represented by the official inventory contract.

| Market | Base Store | EPP | P1 / QST | P2 / DST only | DST total |
|---|---:|---:|---:|---:|---:|
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

Priority and store are independent dimensions:

- P1 runs in QST + DST;
- P2 runs in DST only;
- Base Store and EPP remain distinct contexts.

`test-mapping/smb-qst.json` is preserved historical Zephyr traceability and is not the current P1 denominator.

## 2. Active MX execution model

MX has 38 P1 rows overall. The historical Base Store source contains 30 P1 rows, but `SAM-25006` is excluded from active MX execution because the inherited PSE path is Colombia-specific rather than a valid MX payment path.

The active MX Base Store runner therefore executes **29 TCs** on either S1/STG or S2/STG2. Environment selection changes configuration/endpoints, not the active TC inventory.

## 3. Proven runtime baseline

The stabilized MX S2 baseline is:

```text
selected=29
executed=29
passed=28
failed=1
blocked=0
notRun=0
```

The only current FAIL is `SAM-25010`: guest Track Order creates an order, receives/accepts OTP, then the current BaseSite cannot resolve that new order. The framework preserves the product/environment defect instead of weakening the assertion.

## 4. Runtime, coverage, scope and history stay separate

The architecture keeps four dimensions independent:

- **Runtime result** — PASS / FAIL / BLOCKED / NOT_RUN for one execution;
- **Automation coverage** — what is implemented;
- **Official scope** — current Samsung inventory;
- **Historical evidence** — previous Zephyr/PreQA2/runtime ledgers and campaigns.

No reporting layer may infer PASS from coverage or from missing execution data.

## 5. Current physical repository

```text
config/                 market/runtime configuration
fixtures/               compatibility test data; PE data is being namespaced
flows/                  reusable storefront/business flows
pages/                  Page Objects (shared + market-specific still mixed)
reporters/
  evidence/              evidence reporter
  executive/             legacy/current executive utilities
  executive-v3/          active Executive Dashboard generator
  preqa2/                governance/reporting compatibility
  tests/                 reporting integrity tests
scripts/                 auth + execution + reporting + governance CLIs (still flat)
test-mapping/
  *.json                  scope/mapping/runtime/governance data
  tests/                  governance integrity tests
tests/
  s1/
    mx/{qst,dst}/         active MX generation
    pe/qst/               newer PE QST stabilization generation
    smb/qst/              shared SMB candidates
  s2/
    pe/{qst,dst}/         established PE/ST2 compatibility generation
utils/                   runtime + governance helpers still mixed
```

Already-completed cleanup:

- root `reporter-tests/` consolidated into `reporters/tests/`;
- root `mapping-tests/` consolidated into `test-mapping/tests/`;
- empty placeholders removed;
- non-payment PE fixtures namespaced under `fixtures/pe/`;
- generated/runtime clutter hidden from the VS Code explorer/search;
- stale discovery/handoff documents removed from the active docs tree.

The repository structure guard is available through:

```bash
npm run repo:architecture:validate
```

## 6. Target physical architecture

```text
tests/
  mx/
    qst/{base-store,epp,backoffice}/
    dst/{base-store,epp,backoffice}/
  pe/
    qst/{base-store,epp,backoffice}/
    dst/{base-store,epp,backoffice}/
  cl/
  co/
  shared/

pages/
  shared/
  mx/
  pe/
  backoffice/

flows/
  shared/
  mx/
  pe/

reporting/
  executive/
  allure/
  evidence/
  tests/

governance/
  scope/
  mapping/
  reconciliation/
  tests/

scripts/
  auth/
  ci/
  reporting/
  governance/
```

The key rule is: **market is a physical taxonomy; S1/S2 is runtime configuration**.

## 7. Why S1/S2 remains in test paths temporarily

The active MX runner, Playwright project matching, package scripts, relative imports, reporter source paths and Jenkins commands still reference `tests/s1/mx/...` directly.

Moving that directory is therefore not a harmless rename. It must be atomic across:

- Playwright config;
- MX runners;
- package scripts;
- Jenkinsfile;
- relative imports;
- reporting/governance source-path assumptions;
- docs and targeted commands.

The current path is a compatibility layer until the market-first move is runtime-validated.

## 8. PE dual-generation problem

PE exists in both `tests/s1/pe` and `tests/s2/pe` and must be reconciled per TC:

- `tests/s2/pe/dst` — established ST2/DST generation;
- `tests/s2/pe/qst` — older QST generation;
- `tests/s1/pe/qst` — newer regional QST stabilization generation.

Folder age alone is not enough evidence to delete either implementation.

## 9. Page Object strategy

Current Page Objects remain flat for compatibility while active MX and PE generations share imports.

Target ownership:

- `pages/shared` — genuinely cross-market storefront components;
- `pages/mx` — MX-specific checkout/tracking behavior;
- `pages/pe` — PE-specific behavior;
- `pages/backoffice` — BackOffice-only objects.

Large file size alone is not a reason to split a Page Object. Responsibility and consumer boundaries decide decomposition.

## 10. Authentication model

MX registered execution uses environment-specific persisted state under ignored `playwright/.auth/`.

Policy:

- local auto-renew enabled unless `MX_AUTH_AUTO_RENEW=0`;
- Jenkins auto-renew disabled unless explicitly enabled;
- MFA/CAPTCHA is never bypassed;
- failed renewal stays a failure/blocker;
- second-account state is validated only when `SAM-24986` is selected.

## 11. Payment data boundary

Two card-data mechanisms coexist today:

- the versioned generic card fixture remains a PE/DST compatibility dependency through `utils/testData.js`;
- `playwright/.auth/mx-test-card.json` is runtime-only MX test-card data consumed by `utils/mxTestCard.js`.

They must not be collapsed until the PE payment-data path is migrated safely.

## 12. Reporting architecture

Reporting implementation and integrity tests now share the `reporters/` boundary. This removed the old top-level `reporter-tests/` split without changing runtime reporting behavior.

The presentation stack remains:

1. Executive Dashboard — build/release health;
2. Allure — TC-level drilldown and evidence;
3. Playwright — execution/trace detail;
4. Jenkins — orchestration and publication.

A later naming migration may rename `reporters/` to `reporting/`, but the current consolidation is already one ownership boundary and avoids unnecessary path churn.

## 13. Governance architecture

Governance data and integrity tests now share `test-mapping/`:

```text
test-mapping/
  *.json
  tests/
```

The old root `mapping-tests/` folder has been removed. Governance-oriented helpers/scripts remain spread across `utils/` and `scripts/`; those are the next low-risk consolidation candidates before test-path migration.

## 14. Safety boundaries

Production is read-only. Destructive non-Production actions remain explicitly guarded. Payment/order submission uses zero retries in the controlled campaign. Backend/environment defects must not be hidden by weakened assertions.

## 15. Refactor acceptance

Every architecture phase must preserve:

- official scope gates;
- runner selection correctness;
- secret/runtime-only artifact handling;
- reporting generation;
- current MX behavior.

For MX-affecting changes, the acceptance baseline is the official 29-TC campaign. A new automation failure introduced by refactor blocks the next migration phase.

See `REPOSITORY_AUDIT.md` for the detailed KEEP / RELOCATE / LEGACY / DELETE classification.
