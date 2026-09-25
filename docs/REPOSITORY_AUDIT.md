# Repository Architecture Audit

Status: active refactor plan for `agent/mx-qst-p1-finish`.

## Baseline that must not regress

Current MX S2 official Base Store P1 baseline:

- 29 active official TCs selected;
- 28 PASS;
- 1 functional FAIL: `SAM-25010` Track Order accepts OTP but cannot resolve the newly created order in the current BaseSite;
- 0 BLOCKED;
- 0 NOT_RUN.

Architecture cleanup must preserve that behavior. Import success alone is not enough; official scope, report generation and runtime behavior remain the acceptance contract.

## What was confusing

The repository grew in layers and exposed historical implementation decisions as if they were the current architecture:

1. S1/S2 are encoded in physical test paths even though environment is now runtime configuration;
2. PE exists in both `tests/s1/pe` and `tests/s2/pe` with different automation generations;
3. MX QST still consumes authenticated fixture/flow code from the MX DST compatibility location;
4. reporting implementation and tests used to be split across root folders;
5. governance data and integrity tests used to be split across root folders;
6. `pages/`, `utils/` and `scripts/` still mix shared, market-specific and compatibility responsibilities;
7. documentation contained current contracts mixed with obsolete discovery/handoff material.

## Completed cleanup

### Phase 0 — inventory / zero-risk cleanup ✅

Completed:

- removed empty `pages/CookiePage.js` placeholder;
- removed empty `docs/test-plan.md`;
- added ownership README files for `config`, `fixtures`, `flows`, `pages`, `reporters`, `scripts`, `test-mapping`, `tests` and `utils`;
- cleaned `.gitignore` and added VS Code exclusions for generated/runtime-only artifacts;
- added `.vscode/settings.json` so `node_modules`, Playwright/Allure output, test results and runtime auth files do not dominate the Explorer/search;
- corrected MX active Base Store P1 documentation to 29 TCs with `SAM-25006` preserved as an audited exclusion;
- documented the proven 28 PASS / 1 functional FAIL MX S2 baseline.

### Phase 1 — docs / ownership boundaries ✅

Completed:

- root `README.md` is now the project/platform entry point;
- `docs/README.md` is the documentation index;
- obsolete BackOffice discovery, PreQA2 investigation, old ST2 context/handoff, old QST guide and health-audit snapshots were removed from the active docs tree and remain available in Git history;
- current architecture, Jenkins, priority and coverage docs were reconciled with the active runner.

### Phase 2A — reporting consolidation ✅

Completed:

- removed root `reporter-tests/`;
- moved reporting integrity tests and their fixtures/config into `reporters/tests/`;
- updated package scripts and reporting helpers to use the consolidated boundary.

Current reporting ownership:

```text
reporters/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/
```

A future `reporters/` -> `reporting/` rename is cosmetic compared with the ownership consolidation already completed and is intentionally lower priority than test-path cleanup.

### Phase 2B — governance consolidation ✅

Completed:

- removed root `mapping-tests/`;
- moved governance integrity tests under `test-mapping/tests/`;
- updated package scripts/test-relative imports;
- kept runtime/scope ledgers beside their integrity tests instead of duplicating a second root boundary.

Current governance ownership:

```text
test-mapping/
  *.json
  tests/
```

A future `test-mapping/` -> `governance/` rename remains possible, but it is naming debt rather than an ownership split.

### Phase 2C — fixture cleanup ✅ / partial

Completed:

- namespaced PE non-payment fixtures under `fixtures/pe/`;
- updated `utils/testData.js` accordingly;
- documented that the generic versioned card fixture is **not** MX runtime payment data.

Intentionally not moved/deleted:

- the generic PE/DST card fixture remains in its compatibility location because current PE DST still consumes it;
- MX active payment data remains runtime-only under ignored `playwright/.auth/mx-test-card.json`.

### Architecture regression guard ✅

Added:

```bash
npm run repo:architecture:validate
```

The guard fails if completed cleanup regresses (for example root `mapping-tests/` / `reporter-tests/` reappear, empty placeholders return, or required ownership boundaries disappear).

## Current classification

### KEEP — active runtime contracts

- `Jenkinsfile`
- `playwright.config.js`
- `package.json` / `package-lock.json`
- `config/markets/`
- active MX P1 tests under `tests/s1/mx/qst/base-store/`
- MX auth/runtime helpers used by Jenkins
- Page Objects consumed by active MX/PE automation
- `flows/smb/`
- `reporters/evidence/`
- `reporters/executive-v3/`
- official inventory/runtime ledgers under `test-mapping/`
- `docs/smb_priority_templates/`

### KEEP BUT RELOCATE — valid code, confusing physical location

- `tests/s1/mx/*` -> target `tests/mx/*`
- `tests/s1/pe/qst/*` + `tests/s2/pe/*` -> target `tests/pe/*` after per-TC PE reconciliation
- `tests/s1/smb/*` -> target `tests/shared/*`
- auth scripts/helpers -> target `scripts/auth/` / explicit auth boundary
- CI runners/finalizers -> target `scripts/ci/`
- governance CLIs -> target `scripts/governance/`
- reporting CLIs -> target `scripts/reporting/`
- market-specific Page Objects -> target `pages/{mx,pe,backoffice}` after import migration

### LEGACY / HISTORICAL — preserve until zero usage is proven

- `tests/s2/pe/dst/**` — established PE/ST2 generation; package scripts still execute it;
- `tests/s2/pe/qst/**` — older PE QST generation; must be reconciled against `tests/s1/pe/qst/**` before removal;
- `test-mapping/smb-qst.json` — historical Zephyr campaign, not current P1 denominator;
- `test-mapping/mx-s1-qst-runtime.json` — historical/runtime reconciliation ledger;
- PreQA2 data/CLIs still referenced by governance/reporting tests;
- generic PE fixture bundle through `utils/testData.js`;
- legacy reconciliation utilities/scripts that still participate in governance commands.

### DELETE — proven dead

Already removed:

- `pages/CookiePage.js`
- `docs/test-plan.md`
- obsolete discovery/handoff documents that contradicted or duplicated current contracts
- root `reporter-tests/` after migration to `reporters/tests/`
- root `mapping-tests/` after migration to `test-mapping/tests/`

## Highest-risk remaining work

### Phase 3 — market-first test-path migration

Target:

```text
tests/<market>/<qst|dst>/<store>/
```

This is the change that will make the VS Code test tree immediately intuitive, but it touches:

- Playwright project matching;
- MX/PE runners;
- Jenkins paths;
- package scripts;
- relative imports;
- reporting source paths;
- docs and local commands.

Because MX P1 is now stabilized, this move must be atomic and then runtime-validated. Do not duplicate S1 and S2 specs in the new tree; environment remains runtime configuration.

### Phase 4 — PE reconciliation / legacy deletion

Compare `tests/s1/pe/qst` vs `tests/s2/pe/qst` per TC and choose one canonical implementation. Only after runner/package consumers point at the canonical generation can superseded PE QST files be removed.

### Phase 5 — scripts / Page Object decomposition

After test paths stop moving:

- group scripts under `auth`, `ci`, `reporting`, `governance`;
- move BackOffice-specific Page Objects together;
- separate truly MX-specific Page Objects from shared storefront components;
- split large Cart/Checkout objects only where stable business responsibilities justify it.

This ordering avoids changing the same imports twice.

## Canonical target architecture

```text
samsung-order-automation/
├── tests/
│   ├── mx/
│   │   ├── qst/{base-store,epp,backoffice}/
│   │   └── dst/{base-store,epp,backoffice}/
│   ├── pe/
│   │   ├── qst/{base-store,epp,backoffice}/
│   │   └── dst/{base-store,epp,backoffice}/
│   ├── cl/
│   ├── co/
│   └── shared/
├── pages/{shared,mx,pe,backoffice}/
├── flows/{shared,mx,pe}/
├── config/
├── reporters/{evidence,executive,executive-v3,preqa2,tests}/
├── test-mapping/{tests,...governance data}
├── scripts/{auth,ci,reporting,governance}/
├── docs/
├── Jenkinsfile
├── playwright.config.js
└── package.json
```

The final naming of `reporters` and `test-mapping` is less important than having one obvious owner for each concern. The remaining architectural priority is the test tree because that is what engineers navigate most often.

## Migration rules

1. S1/S2 are runtime configuration, not permanent physical taxonomy.
2. Market precedes suite: `tests/<market>/<qst|dst>/<store>`.
3. Shared code must actually be cross-market.
4. No destructive test is parallelized or blindly retried during refactor.
5. Nothing is deleted based only on age/name.
6. Runtime result, implementation coverage, official scope and historical evidence remain separate.
7. One concern per commit; changes stay reversible.
8. `npm run repo:architecture:validate` runs after structural edits.
9. MX-affecting migrations are accepted only when the official 29-TC runner preserves the established behavior.

## Definition of done

The architecture refactor is complete when:

- market/suite/store are obvious from every executable test path;
- S1/S2 selection is runtime configuration instead of duplicated top-level taxonomy;
- reporting and governance each have one ownership boundary;
- scripts/Page Objects have clear responsibility folders;
- PE has one canonical QST generation;
- dead placeholders/duplicated discovery material are gone;
- root README and docs index agree on scope and architecture;
- MX S2 official P1 still produces the established baseline or better, with `SAM-25010` remaining a real product defect until Samsung fixes it.
