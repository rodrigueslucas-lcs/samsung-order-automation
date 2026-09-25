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

### Phase 2A — reporting consolidation ✅

Root `reporter-tests/` was removed. Reporting implementation and integrity tests now share:

```text
reporters/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/
```

### Phase 2B — governance consolidation ✅

Root `mapping-tests/` was removed. Governance data and integrity tests now share:

```text
test-mapping/
  *.json
  tests/
```

### Phase 2C — fixture cleanup ✅ / compatibility retained

- PE non-payment fixtures were namespaced under `fixtures/pe/`;
- `utils/testData.js` was aligned;
- `fixtures/card.json` remains because current PE/DST compatibility still consumes it;
- active MX payment data remains ignored/runtime-only under `playwright/.auth/mx-test-card.json`.

### Phase 3A — canonical market-first test navigation ✅

A canonical engineer-facing tree now exists:

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

Mapping during cutover:

```text
tests/s1/mx   <-> tests/markets/mx
tests/s1/pe   <-> tests/markets/pe
tests/s1/smb  <-> tests/markets/shared
tests/s2/pe   <-> tests/legacy/pe-s2
```

The compatibility roots still exist for stable consumers, but VS Code hides `tests/s1` and `tests/s2` by default. Engineers therefore see the intended architecture immediately without a risky big-bang runtime rename.

Canonical mirrors are protected against accidental drift by:

```bash
npm run repo:architecture:validate
```

The guard validates repository boundaries and performs byte-for-byte mirror comparison while compatibility sources remain.

MX DST package commands and the MX fast-guest runner already use canonical paths. The full official P1 runner remains on the compatibility path until its runner + Playwright project matching + Jenkins direct consumers can be cut over atomically and runtime-validated.

## Current classification

### KEEP — active contracts

- `Jenkinsfile`
- `playwright.config.js`
- `package.json` / `package-lock.json`
- `config/markets/`
- `tests/markets/mx/**`
- `tests/markets/pe/**`
- `tests/markets/shared/**`
- MX auth/runtime helpers used by CI
- active Page Objects / flows consumed by MX or PE
- `reporters/evidence/`, `reporters/executive-v3/`
- official inventory/runtime ledgers under `test-mapping/`
- `docs/smb_priority_templates/`

### TEMPORARY COMPATIBILITY — do not add conceptual ownership here

- `tests/s1/mx/**`
- `tests/s1/pe/**`
- `tests/s1/smb/**`
- `tests/s2/pe/**`

These remain only until all consumers are switched to the canonical/legacy boundaries and runtime acceptance is proven.

### LEGACY — explicit, not hidden as current architecture

- `tests/legacy/pe-s2/**` — older PE/ST2 generation plus established PE DST coverage pending reconciliation;
- `test-mapping/smb-qst.json` — historical Zephyr campaign;
- `test-mapping/mx-s1-qst-runtime.json` — historical/runtime reconciliation;
- PreQA2 compatibility data/CLIs still consumed by governance/reporting;
- generic PE card fixture path while PE consumers still depend on it.

### DELETE — already proven dead and removed

- `pages/CookiePage.js`
- `docs/test-plan.md`
- obsolete discovery/handoff docs
- root `reporter-tests/`
- root `mapping-tests/`

## Remaining work

### Phase 3B — official MX runtime cutover

Switch, as one coordinated change:

- `scripts/run-mx-qst-safe.cjs`;
- `playwright.config.js` auth-priority patterns;
- Jenkins direct MX test paths;
- any reporting/source-path assumptions.

Then validate discovery/gates and run the official MX S2 29-TC campaign. Only after it reproduces the established baseline can `tests/s1/mx` be deleted.

### Phase 4 — PE reconciliation

Reconcile `tests/markets/pe` against `tests/legacy/pe-s2` per TC and per consumer. Choose one canonical implementation before removing any old PE QST. Preserve established DST until an equivalent canonical path is proven.

### Phase 5 — scripts decomposition

Target:

```text
scripts/auth/
scripts/ci/
scripts/reporting/
scripts/governance/
```

This must be an executable move, not a cosmetic copy, because current scripts rely on relative `../utils`, sibling scripts and package/Jenkins paths.

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

Move by responsibility and consumer evidence after test-path cutover so imports are not churned twice.

## Migration rules

1. S1/S2 are runtime configuration, not business taxonomy.
2. Canonical test navigation is market -> suite -> store.
3. Shared code must actually be cross-market.
4. No destructive scenario is parallelized or blindly retried during refactor.
5. Nothing is deleted based only on age/name.
6. Runtime result, implementation coverage, official scope and historical evidence stay separate.
7. One concern per commit; changes stay reversible.
8. `npm run repo:architecture:validate` runs after structural edits.
9. Compatibility sources are deleted only after runtime cutover is proven.
10. MX-affecting migration is accepted only if the official runner preserves the established 29-executed baseline without new automation failures.

## Definition of done

The refactor is complete when:

- VS Code exposes one obvious market-first test tree;
- no runtime consumer depends on `tests/s1` or `tests/s2`;
- PE has one canonical current generation and explicit historical evidence only where needed;
- reporting/governance each have one ownership boundary;
- scripts and Page Objects have responsibility folders;
- dead placeholders and duplicate discovery material stay removed;
- docs and code agree on architecture;
- MX S2 official P1 remains stable, with `SAM-25010` failing only while the Samsung product defect remains reproducible.
