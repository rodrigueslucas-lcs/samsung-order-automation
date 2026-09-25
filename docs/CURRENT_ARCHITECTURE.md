# Current SMB QA Automation Architecture

This document describes the **current executable architecture** and the **target physical architecture**. The repository is in a controlled migration: runtime behavior is stabilized, but some paths still expose historical S1/S2 organization.

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

`test-mapping/smb-qst.json` is a preserved historical 144-ID Zephyr campaign and is not the current P1 denominator.

## 2. Active MX execution model

MX has 38 P1 rows overall.

The historical Base Store source has 30 P1 rows, but `SAM-25006` is excluded from active MX execution because the PSE path in the inherited test data is Colombia-specific and not a valid MX payment path.

Therefore the active MX Base Store runner executes **29 TCs** on either:

- S1 / `stg.shop.samsung.com`;
- S2 / `stg2.shop.samsung.com`.

The exclusion is preserved for audit. Environment selection changes configuration/endpoints, not the active TC inventory.

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

The only current FAIL is `SAM-25010`, where guest Track Order accepts OTP but cannot find the newly created order in the current BaseSite. This is treated as a real functional/environment defect rather than an automation problem.

## 4. Runtime, coverage, scope and history stay separate

The architecture deliberately separates:

- **Runtime result**: PASS / FAIL / BLOCKED / NOT_RUN for one execution;
- **Automation coverage**: implementation maturity;
- **Official scope**: current Samsung inventory;
- **Historical evidence**: Zephyr/PreQA2/runtime ledgers and previous campaigns.

No reporting layer may infer PASS from coverage or from the absence of an execution result.

## 5. Environment routing

PreQA2 may validate supported storefront/catalog behavior. Cart, Checkout, Orders, Payment and BackOffice use the applicable staging environment where the complete journey exists.

A PreQA2 `NOT_APPLICABLE` result creates a staging validation obligation; it is not PASS.

Production is never a fallback target.

## 6. Current physical repository

```text
tests/
  s1/
    mx/
      qst/
      dst/
    pe/
      qst/
    smb/
      qst/
  s2/
    pe/
      qst/
      dst/

pages/          Page Objects, currently shared + market-specific mixed
flows/          reusable SMB flows
utils/          runtime helpers + governance helpers mixed
scripts/        auth + CI + reporting + governance CLIs mixed
reporters/      reporting implementation
reporter-tests/ reporting integrity tests
test-mapping/   scope/mapping/runtime data
mapping-tests/  governance integrity tests
```

This layout is functional but not the desired final taxonomy.

## 7. Target physical architecture

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

The key rule is that **market is a physical taxonomy; S1/S2 is runtime configuration**.

## 8. Why S1/S2 stays in paths temporarily

The active MX runner, Playwright project matching, package scripts, relative imports, reporting source paths and Jenkins commands currently reference `tests/s1/mx/...` directly.

Moving the directory is therefore not a harmless rename. It must be performed atomically across:

- Playwright config;
- MX runners;
- package scripts;
- Jenkinsfile;
- relative imports;
- reporter/governance source-path assumptions;
- docs;
- targeted commands.

Until that migration can be validated, the current path remains a compatibility layer.

## 9. PE dual-generation problem

PE exists in both `tests/s1/pe` and `tests/s2/pe`.

They are not safe to merge/delete by folder age:

- `tests/s2/pe/dst` is the established ST2/DST generation;
- `tests/s2/pe/qst` is an older QST generation;
- `tests/s1/pe/qst` is the newer regional QST stabilization generation.

The PE migration must reconcile per-TC ownership before deleting either tree.

## 10. Page Object strategy

Current Page Objects are intentionally not split during the first architecture pass because many are shared by PE DST and MX QST.

Future decomposition should follow stable responsibility:

- `pages/shared`: genuinely cross-market components;
- `pages/mx`: MX-specific checkout/tracking behavior;
- `pages/pe`: PE-specific behavior;
- `pages/backoffice`: BackOffice-only objects.

Large file size alone is not a reason to split a Page Object.

## 11. Authentication model

WMC/PreQA2 authentication and Samsung Account authentication are separate concerns.

MX registered execution uses environment-specific persisted state under ignored `playwright/.auth/`.

Policy:

- local auto-renew enabled unless `MX_AUTH_AUTO_RENEW=0`;
- Jenkins auto-renew disabled unless explicitly enabled;
- MFA/CAPTCHA is never bypassed;
- failed renewal stays a failure/blocker;
- second-account state is validated only when `SAM-24986` is selected.

## 12. Payment data boundary

Two card-data mechanisms currently coexist for valid reasons:

- `fixtures/card.json` belongs to the older PE/DST test-data bundle through `utils/testData.js`;
- `playwright/.auth/mx-test-card.json` is the runtime-only MX credential consumed by `utils/mxTestCard.js`.

They must not be collapsed until PE is migrated away from the generic fixture bundle.

## 13. Reporting architecture

### Executive Dashboard

Outcome-first presentation and release-health view.

### Allure

Technical TC-level drilldown, attachments and categories.

### Playwright

Execution detail and trace investigation.

### Jenkins

Orchestration, gates, credentials, execution and publication.

The current `reporters/` + `reporter-tests/` split is a naming/placement debt. It should eventually become one `reporting/` boundary, but only after scripts/config imports are changed together.

## 14. Governance architecture

Current governance is distributed across:

- `test-mapping/`;
- `mapping-tests/`;
- governance-oriented `utils/`;
- `print-*` / `validate-*` scripts.

The target is one `governance/` boundary with scope, mapping, reconciliation and tests clearly separated from runtime browser automation.

## 15. Safety boundaries

Production is read-only.

Destructive non-Production actions remain explicitly guarded. Payment/order submission uses zero retries in the controlled campaign. Backend/environment defects must not be hidden by weakened assertions.

## 16. Refactor acceptance

Every architecture phase must preserve:

- official scope gates;
- runner selection correctness;
- secret/runtime-only artifact handling;
- reporting generation;
- current MX behavior.

For MX-affecting changes, the acceptance baseline is the official 29-TC campaign. A new automation failure introduced by a refactor blocks the next migration phase.

See `REPOSITORY_AUDIT.md` for the detailed KEEP / RELOCATE / LEGACY / DELETE classification.
