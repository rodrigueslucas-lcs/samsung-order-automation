# Repository Architecture Audit

Status: active controlled refactor on `agent/mx-qst-p1-finish`.

## Non-regression baseline

MX S2 official Base Store P1 before architecture cutover:

```text
29 selected
29 executed
28 PASS
1 functional FAIL -> SAM-25010 Track Order
0 BLOCKED
0 NOT_RUN
```

`SAM-25010` is a real product/environment failure after successful guest-order creation and OTP acceptance. Architecture work must not hide it or introduce additional automation failures.

## Audit conclusion

The repository had four main architecture problems:

1. environment (`s1`/`s2`) was exposed as physical taxonomy even though environment is runtime configuration;
2. reporting/governance ownership was split across duplicate root boundaries;
3. PE has two automation generations whose names look like environment variants but actually represent different implementation generations;
4. scripts/Page Objects still mix responsibilities in flat folders.

The cleanup is being performed by ownership and consumer evidence, never by filename age alone.

## Completed phases

### Phase 0 — inventory and dead-file cleanup ✅

- removed empty `pages/CookiePage.js`;
- removed empty `docs/test-plan.md`;
- removed obsolete discovery/handoff docs from the active documentation tree;
- added ownership READMEs;
- cleaned generated/runtime clutter from VS Code navigation;
- corrected active MX P1 documentation to 29 TCs with `SAM-25006` preserved as an audited exclusion.

### Phase 1 — documentation ownership ✅

- root `README.md` is the platform entry point;
- `docs/README.md` is the documentation index;
- current architecture, Jenkins, scope and coverage docs were reconciled with the active runner.

### Phase 2A — reporting canonicalization ✅ / compatibility removed

Canonical ownership is now:

```text
reporting/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/
```

Root `reporter-tests/` and the temporary `reporters/` mirror are removed. Package commands, Playwright reporting and active runners resolve only through `reporting/`.

### Phase 2B — governance canonicalization ✅ / compatibility removed

Canonical ownership is now:

```text
governance/
  *.json
  tests/
```

Root `mapping-tests/` and the temporary `test-mapping/` mirror are removed. Package commands and active runners resolve only through `governance/`.

### Phase 2C — fixture cleanup ✅ / compatibility retained

- PE non-payment fixtures were namespaced under `fixtures/pe/`;
- `utils/testData.js` was aligned;
- `fixtures/card.json` remains because current PE/DST compatibility still consumes it;
- active MX payment data remains ignored/runtime-only under `playwright/.auth/mx-test-card.json`.

### Phase 3A — canonical market-first test navigation ✅

Canonical engineer-facing tree:

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
```

Compatibility mapping during runtime acceptance:

```text
tests/s1/pe   <-> tests/markets/pe
tests/s1/smb  <-> tests/markets/shared
tests/s2/pe   <-> tests/legacy/pe-s2
```

VS Code hides the remaining `tests/s1` and `tests/s2` PE/shared compatibility roots. Reporting and governance no longer require hidden compatibility roots.

Canonical mirrors are protected by:

```bash
npm run repo:architecture:validate
```

The guard performs repository-boundary validation and byte-for-byte mirror comparison while compatibility sources remain.

### Phase 3B — official MX runtime path cutover ✅ RUNTIME ACCEPTED

The active MX execution surface has been moved to canonical boundaries in code:

- `scripts/run-mx-qst-safe.cjs` discovers and executes `tests/markets/mx/qst/base-store`;
- Jenkins direct authenticated-safe paths use `tests/markets/mx/...`;
- Jenkins BackOffice-safe paths use `tests/markets/shared/...`;
- MX fast guest and MX DST commands already use canonical paths;
- MX runner Executive generation resolves `reporting/` + `governance/`;
- active architecture validation rejects regressions back to `tests/s1`, `tests/s2`, `reporters/` or `test-mapping/` in production entry points.

Jenkins Build #52 proved the post-cutover contract: 29 selected, 29 executed, 28 PASS, 1 known FAIL (`SAM-25010`), 0 blocked and 0 not-run. The PreQA2 CDP preflight passed and all three previously session-blocked PreQA2 TCs passed.

The accepted `tests/s1/mx` compatibility tree and dual Playwright matching are removed.

## Current classification

### KEEP — canonical active contracts

- `Jenkinsfile`
- `playwright.config.js`
- `package.json` / `package-lock.json`
- `config/markets/`
- `tests/markets/mx/**`
- `tests/markets/pe/**`
- `tests/markets/shared/**`
- `tests/legacy/pe-s2/**` while PE generation reconciliation is open
- `reporting/**`
- `governance/**`
- MX auth/runtime helpers used by CI
- active Page Objects / flows consumed by MX or PE
- `docs/smb_priority_templates/`

### TEMPORARY COMPATIBILITY — hidden; no new ownership allowed

- `tests/s1/pe/**`
- `tests/s1/smb/**`
- `tests/s2/pe/**`

These exist only as rollback/mirror sources while runtime cutovers are accepted. Architecture validation prevents silent drift.

### LEGACY — explicit business/implementation history

- `tests/legacy/pe-s2/**` — older PE/ST2 generation plus established PE DST coverage pending reconciliation;
- `governance/smb-qst.json` — historical Zephyr campaign;
- `governance/mx-s1-qst-runtime.json` — historical/runtime reconciliation;
- PreQA2 compatibility data/CLIs still consumed by governance/reporting;
- generic PE card fixture path while PE consumers still depend on it.

### DELETE — already proven dead and removed

- `pages/CookiePage.js`
- `docs/test-plan.md`
- obsolete discovery/handoff docs
- root `reporter-tests/`
- root `mapping-tests/`

## Remaining controlled work

### Acceptance checkpoint — completed for MX

Jenkins Build #52 completed the MX acceptance checkpoint with 29 selected/executed, 28 PASS, only the known `SAM-25010` FAIL, and zero blocked/not-run. MX compatibility deletion is therefore complete. Remaining compatibility work is PE/shared-specific and stays gated by its own consumer/runtime evidence.

### Phase 4 — PE reconciliation

Reconcile `tests/markets/pe` against `tests/legacy/pe-s2` per TC and per consumer. Choose one canonical current implementation before removing older PE QST. Preserve established DST until equivalent canonical coverage is proven.

### Phase 5 — scripts decomposition

Target:

```text
scripts/auth/
scripts/ci/
scripts/reporting/
scripts/governance/
```

Execute this after the MX test-path acceptance checkpoint. Current flat script entry points remain stable so authentication/Jenkins behavior is not churned in the same acceptance run as test discovery.

### Phase 6 — Page Object / flow ownership

Target:

```text
pages/shared/
pages/mx/
pages/pe/
pages/backoffice/
flows/shared/
flows/mx/
flows/pe/
```

Move by responsibility and consumer evidence after test-path acceptance so imports are not churned twice.

## Migration rules

1. S1/S2 are runtime configuration, not business taxonomy.
2. Canonical test navigation is market -> suite -> store.
3. Shared code must actually be cross-market.
4. No destructive scenario is parallelized or blindly retried during refactor.
5. Nothing is deleted based only on age/name.
6. Runtime result, implementation coverage, official scope and historical evidence stay separate.
7. One concern per commit; changes stay reversible.
8. `npm run repo:architecture:validate` is the structural gate.
9. Compatibility sources are deleted only after their active consumers are cut over and runtime acceptance is proven.
10. MX-affecting migration is accepted only if the official runner preserves the established 29-executed baseline without new automation failures.

## Definition of done

The refactor is complete when:

- VS Code exposes one obvious market-first test tree;
- no runtime consumer depends on `tests/s1` or `tests/s2`;
- post-cutover MX S2 acceptance has proven the canonical runner;
- compatibility MX test copies are physically deleted after that proof;
- PE has one canonical current generation and explicit historical evidence only where needed;
- reporting/governance each have one physical ownership boundary after acceptance;
- scripts and Page Objects have responsibility folders;
- dead placeholders and duplicate discovery material stay removed;
- docs and code agree on architecture;
- MX S2 official P1 remains stable, with `SAM-25010` failing only while the Samsung product defect remains reproducible.
