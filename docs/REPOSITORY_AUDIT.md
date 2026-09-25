# Repository Architecture Audit

Branch status: deep structural work lives on `refactor/market-first-architecture`; the stabilized runtime branch remains `agent/mx-qst-p1-finish` until this refactor is runtime-validated.

## Non-regression baseline

MX S2 official Base Store P1:

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 functional Track Order defect
0 BLOCKED
0 NOT_RUN
```

A refactor is not runtime-proven merely because paths/imports are statically consistent.

## Completed audit findings

The repository had accumulated four kinds of debt:

1. environment-first test paths (`tests/s1`, `tests/s2`) even though S1/S2 are runtime selection;
2. two PE QST generations presented as peers;
3. reporting/governance concerns spread across multiple root folders;
4. stale/ambiguous docs and empty placeholders that made historical code look current.

## Completed Phase 0/1 cleanup

- removed empty `pages/CookiePage.js`;
- removed empty `docs/test-plan.md`;
- rewrote root README and docs index around current scope/runtime;
- documented current vs historical/compatibility assets;
- added folder-level ownership READMEs;
- added VS Code settings to hide generated/runtime noise and disable compact-folder collapsing;
- cleaned `.gitignore` for generated reports/auth state;
- made current versus legacy PE npm entry points explicit;
- moved non-payment PE fixtures under `fixtures/pe/` while preserving the legacy PE card boundary.

## Completed Phase 3 physical test migration on refactor branch

Environment-owned roots are removed from the refactor branch.

Current tree:

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

Canonical paths are centralized in `config/testPaths.cjs`.

Execution contracts updated:

- `playwright.config.js`;
- `package.json`;
- `Jenkinsfile` direct diagnostic paths;
- `scripts/run-mx-qst-safe.cjs`;
- `scripts/run-mx-qst-fast-guest.cjs`;
- `scripts/run-pe-qst-p1.cjs`;
- `scripts/qst-run.cjs`.

`utils/qstImplementation.js` replaces environment-specific QST discovery logic. `utils/qstS1Implementation.js` remains only as a compatibility shim for callers not yet renamed.

`mapping-tests/marketFirstPaths.test.cjs` prevents executable contracts from reintroducing `tests/s1` or `tests/s2` and asserts the canonical roots exist.

## Current ownership classification

### Current runtime

- `tests/markets/mx/qst` — active MX QST.
- `tests/markets/mx/dst` — MX DST + auth/flow helpers reused by QST.
- `tests/markets/pe/qst` — current regional PE QST stabilization.
- `tests/markets/pe/dst` — established PE DST.
- `tests/shared/smb/qst` — shared/regional candidates.

### Legacy compatibility

- `tests/legacy/pe/qst` — older PE/ST2 QST generation, still reachable through explicit `qst:pe:legacy:*` commands and temporary generic aliases.
- `test-mapping/smb-qst.json` — preserved historical Zephyr campaign, not current P1 denominator.
- PreQA2 discovery/campaign history and runtime ledgers — governance evidence, not current-build truth unless explicitly reconciled.

### Payment fixture boundary

- `fixtures/card.json` remains PE compatibility payment data through `utils/testData.js`.
- active MX payment data remains ignored runtime `playwright/.auth/mx-test-card.json` through `utils/mxTestCard.js`.

Do not merge these data paths until PE payment automation moves to the approved runtime-secret model.

## Remaining architecture debt

### Reporting

Current:

```text
reporters/
reporter-tests/
```

Target:

```text
reporting/
  executive/
  allure/
  evidence/
  preqa2/
  tests/
```

Do this only after the market-first branch passes runtime gates because reporting path churn affects Jenkins publication and test configs.

### Governance

Current:

```text
test-mapping/
mapping-tests/
utils/ governance helpers
scripts/ print/validate/reconcile tools
```

Target:

```text
governance/
  scope/
  mapping/
  reconciliation/
  tests/
```

### Pages / flows

Current `pages/` remains compatibility-flat across MX and PE.

Future target:

```text
pages/{shared,mx,pe,backoffice}/
flows/{shared,mx,pe}/
```

Split by stable business responsibility, not file size.

### PE legacy deletion

Do not delete `tests/legacy/pe/qst` until unique coverage is reconciled into `tests/markets/pe/qst` and old aliases/callers are retired.

### Mapping metadata paths

Some historical/coverage JSON values still contain old source-path strings as traceability metadata. They are not executable paths, but should be normalized after runtime validation so reports no longer show historical locations as current implementation paths.

## Refactor rules

1. S1/S2 are runtime configuration, never physical ownership.
2. New executable tests belong under `tests/markets/<market>` or deliberately under `tests/shared`.
3. No new code belongs under `tests/legacy` unless maintaining an explicit compatibility contract.
4. No destructive test gets broad retries/parallelization to make refactor validation easier.
5. No file is deleted based on age/name alone; imports, npm, Jenkins, reporting and governance consumers are checked first.
6. Official scope, runtime result, implementation coverage and historical evidence remain separate.
7. MX 29-TC official execution is the acceptance gate for MX-affecting structural changes.

## Validation required before merge

At minimum on the refactor branch:

```bash
npm ci
node --test mapping-tests/marketFirstPaths.test.cjs
npm run qst:official:gate
npm run qst:mx:list
npm run reporting:mx-runtime:test
npm run preqa2:validation:test
```

Then run MX S2 official P1 through Jenkins. Expected business baseline is 28 PASS + the known `SAM-25010` product failure, with 0 BLOCKED and 0 NOT_RUN.

Only after that runtime proof should the deep branch be merged into `agent/mx-qst-p1-finish` and the next physical consolidation phase begin.
