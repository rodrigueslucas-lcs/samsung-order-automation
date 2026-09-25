# Repository Architecture Audit

Status: active refactor on `agent/market-first-layout`.

## Baseline that must not regress

Runtime-proven MX S2 official Base Store P1 baseline from Jenkins #49 / commit `22c7e38`:

- 29 active official TCs selected;
- 29 executed;
- 28 PASS;
- 1 functional FAIL: `SAM-25010` Track Order accepts OTP but cannot resolve the newly created order in the current BaseSite;
- 0 BLOCKED;
- 0 NOT_RUN.

The architecture branch is **CODE COMMITTED, not yet RUNTIME VALIDATED**. The refactor is accepted only after static/list gates and the official MX campaign preserve that baseline.

## What was confusing

The repository grew in layers and exposed historical implementation decisions as if they were current architecture:

1. S1/S2 were encoded in physical test paths even though environment is runtime configuration;
2. PE had two QST generations hidden under `s1` and `s2` trees;
3. MX QST consumes authenticated fixture/flow code from its DST compatibility area;
4. reporting implementation and tests were split across root folders;
5. governance data and integrity tests were split across root folders;
6. `pages/`, `utils/` and `scripts/` still mix shared, market-specific and compatibility responsibilities;
7. documentation mixed current contracts with obsolete discovery/handoff material.

## Completed cleanup

### Phase 0 — inventory / zero-risk cleanup ✅

- removed empty `pages/CookiePage.js` placeholder;
- removed empty `docs/test-plan.md`;
- added ownership README files for main boundaries;
- cleaned `.gitignore` and added VS Code exclusions for generated/runtime-only artifacts;
- corrected MX active Base Store P1 documentation to 29 TCs with `SAM-25006` preserved as an audited exclusion;
- documented the proven 28 PASS / 1 functional FAIL MX S2 baseline.

### Phase 1 — docs / ownership boundaries ✅

- root `README.md` is the project/platform entry point;
- `docs/README.md` is the documentation index;
- obsolete BackOffice discovery, PreQA2 investigation, ST2 handoff/context, old QST guide and health-audit snapshots were removed from the active docs tree and remain available in Git history;
- current architecture, Jenkins, priority and coverage docs were reconciled with the active runner.

### Phase 2A — reporting consolidation ✅

- removed root `reporter-tests/`;
- moved reporting integrity tests and their fixtures/config into `reporters/tests/`;
- updated package scripts and reporting helpers.

Current reporting ownership:

```text
reporters/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/
```

### Phase 2B — governance consolidation ✅

- removed root `mapping-tests/`;
- moved governance integrity tests under `test-mapping/tests/`;
- updated package scripts/test-relative imports;
- kept scope/runtime ledgers beside their integrity tests.

Current governance ownership:

```text
test-mapping/
  *.json
  tests/
```

### Phase 2C — fixture cleanup ✅ / compatibility retained

- namespaced PE non-payment fixtures under `fixtures/pe/`;
- updated `utils/testData.js`;
- documented that the generic versioned card fixture is not MX runtime payment data;
- intentionally retained the generic PE/DST card fixture because current PE DST still consumes it;
- MX payment data remains runtime-only under ignored `playwright/.auth/mx-test-card.json`.

### Phase 3 — market-first executable test tree ✅ CODE COMMITTED

Environment-first physical ownership has been removed from the refactor branch.

Old layout:

```text
tests/s1/mx/...
tests/s1/pe/...
tests/s1/smb/...
tests/s2/pe/...
```

New layout:

```text
tests/
  markets/
    mx/{qst,dst}/
    pe/{qst,dst}/
  shared/
    smb/qst/
  legacy/
    pe/qst/
```

The `markets/` segment intentionally preserves the old directory depth, which keeps existing relative test imports stable while removing S1/S2 from physical ownership.

Updated consumers include:

- Playwright MX project matching;
- MX official P1 runner;
- MX fast-guest runner;
- PE canonical P1 runner;
- PE legacy QST runner;
- package scripts;
- Jenkins direct authenticated/backoffice lanes;
- implementation inventory/governance helper;
- architecture documentation.

`tests/legacy/pe/qst` now makes the older PE QST generation explicit instead of disguising it as an S2-owned canonical suite.

### Architecture regression guard ✅

Run:

```bash
npm run repo:architecture:validate
```

The guard now:

- requires canonical market/shared/legacy boundaries;
- rejects resurrected `tests/s1` or `tests/s2` trees;
- rejects old root `mapping-tests` / `reporter-tests` boundaries;
- scans runtime code/config for stale `tests/s1/...` / `tests/s2/...` references.

## Current classification

### KEEP — active runtime contracts

- `Jenkinsfile`
- `playwright.config.js`
- `package.json` / `package-lock.json`
- `config/markets/`
- `tests/markets/mx/qst/base-store/`
- `tests/markets/mx/dst/`
- `tests/markets/pe/qst/`
- `tests/markets/pe/dst/`
- `tests/shared/smb/qst/`
- MX auth/runtime helpers used by Jenkins
- Page Objects consumed by active MX/PE automation
- `flows/smb/`
- `reporters/evidence/`
- `reporters/executive-v3/`
- official inventory/runtime ledgers under `test-mapping/`
- `docs/smb_priority_templates/`

### KEEP BUT RELOCATE LATER — valid code, ownership still flat

- auth scripts/helpers -> future `scripts/auth/` boundary;
- CI runners/finalizers -> future `scripts/ci/` boundary;
- governance CLIs -> future `scripts/governance/` boundary;
- reporting CLIs -> future `scripts/reporting/` boundary;
- market-specific Page Objects -> future `pages/{mx,pe,backoffice}` after import/consumer validation;
- truly shared Page Objects -> future `pages/shared/`;
- market-specific flows -> future `flows/{mx,pe}` once consumers are mapped.

These moves are intentionally after the test-tree validation gate so the same imports are not churned twice before the high-value structure is proven.

### LEGACY / HISTORICAL — explicit, preserve until zero usage is proven

- `tests/legacy/pe/qst/**` — older PE QST generation awaiting per-TC reconciliation;
- `test-mapping/smb-qst.json` — historical Zephyr campaign, not current P1 denominator;
- `test-mapping/mx-s1-qst-runtime.json` — historical/runtime reconciliation ledger; filename is historical metadata, not executable path ownership;
- PreQA2 data/CLIs still referenced by governance/reporting tests;
- generic PE fixture bundle through `utils/testData.js`;
- legacy reconciliation utilities/scripts still used by governance commands.

### DELETE — proven dead

Already removed:

- `pages/CookiePage.js`;
- `docs/test-plan.md`;
- obsolete discovery/handoff documents that contradicted or duplicated current contracts;
- root `reporter-tests/` after migration to `reporters/tests/`;
- root `mapping-tests/` after migration to `test-mapping/tests/`;
- canonical `tests/s1` / `tests/s2` trees after market-first migration.

## Remaining high-value work

### Phase 4 — PE reconciliation / legacy deletion

Compare `tests/markets/pe/qst` against `tests/legacy/pe/qst` per official TC. Select one canonical implementation per TC, route all package/governance consumers to it, then delete superseded legacy specs. Do not infer equivalence from filenames alone.

### Phase 5 — scripts / Page Object decomposition

After the market-first branch passes structural/list gates:

- group scripts under `auth`, `ci`, `reporting`, `governance`;
- move BackOffice-specific Page Objects together;
- separate genuinely MX-specific Page Objects from shared storefront components;
- split large Cart/Checkout objects only where stable responsibilities justify it.

This phase is lower navigation value than the completed test-tree migration and has higher import churn, so it must not be compounded before the current branch is validated.

## Canonical architecture

```text
samsung-order-automation/
├── tests/
│   ├── markets/
│   │   ├── mx/
│   │   │   ├── qst/{base-store,epp,backoffice}/
│   │   │   └── dst/{base-store,epp,backoffice}/
│   │   └── pe/
│   │       ├── qst/{base-store,epp,backoffice}/
│   │       └── dst/{base-store,epp,backoffice}/
│   ├── shared/
│   └── legacy/
├── pages/
├── flows/
├── config/
├── reporters/{evidence,executive,executive-v3,preqa2,tests}/
├── test-mapping/{tests,...governance data}
├── scripts/
├── docs/
├── Jenkinsfile
├── playwright.config.js
└── package.json
```

## Migration rules

1. S1/S2 are runtime configuration, not physical taxonomy.
2. Canonical market automation lives under `tests/markets/<market>/<qst|dst>/<store>`.
3. Shared code must actually be cross-market.
4. Old executable generations belong under explicit `tests/legacy/`, never mixed with canonical suites.
5. No destructive test is parallelized or blindly retried during refactor.
6. Nothing is deleted based only on age/name.
7. Runtime result, implementation coverage, official scope and historical evidence remain separate.
8. One concern per commit; changes stay reversible.
9. `npm run repo:architecture:validate` runs after structural edits.
10. MX-affecting migrations are accepted only when the official 29-TC runner preserves the established behavior.

## Definition of done

The architecture cleanup is complete when:

- market/suite/store are obvious from every canonical executable test path;
- S1/S2 selection is runtime configuration instead of duplicated physical taxonomy;
- reporting and governance each have one ownership boundary;
- legacy PE QST is reconciled to one canonical implementation per TC;
- dead placeholders/duplicated discovery material are gone;
- root README and docs index agree on scope and architecture;
- MX S2 official P1 preserves the established 28 PASS + `SAM-25010` functional-fail baseline or improves because the product defect itself is fixed.
