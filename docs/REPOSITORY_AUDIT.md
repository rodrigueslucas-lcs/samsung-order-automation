# Repository Architecture Audit

Status: active refactor plan for `agent/mx-qst-p1-finish`.

## Baseline that must not regress

The current MX S2 official Base Store P1 baseline is:

- 29 active official TCs selected;
- 28 PASS;
- 1 functional FAIL: `SAM-25010` Track Order accepts OTP but cannot resolve the newly created order in the current BaseSite;
- 0 BLOCKED;
- 0 NOT_RUN.

Any architecture cleanup must preserve this runtime behavior. A refactor is not considered complete merely because imports compile; the official gates and MX P1 runtime remain the acceptance criteria.

## Main finding

The repository evolved in layers. Runtime code is healthy enough to execute the current campaign, but the physical tree still exposes historical implementation decisions as if they were current architecture.

The largest sources of confusion are:

1. environment names (`s1`, `s2`) are encoded in physical test paths even though environment is now a runtime selection;
2. PE exists in both `tests/s1/pe` and `tests/s2/pe`, with different generations of QST/DST automation;
3. MX QST currently imports its authenticated fixture/flows from the historical MX DST location;
4. reporting code is split between `reporters/`, `reporter-tests/`, scripts and fixtures;
5. governance code is split between `test-mapping/`, `mapping-tests/`, `utils/` and scripts;
6. root-level `pages/`, `utils/` and `scripts/` mix shared, market-specific, reporting and historical responsibilities;
7. documentation contains both current contracts and discovery/historical material without a strong current-vs-archive boundary.

## Classification

### KEEP — current runtime contracts

- `Jenkinsfile`
- `playwright.config.js`
- `package.json` / `package-lock.json`
- `config/markets/`
- current MX P1 tests in `tests/s1/mx/qst/base-store/`
- current MX authentication/runtime helpers used by Jenkins
- `pages/` classes referenced by active MX/PE automation
- `flows/smb/`
- `reporters/evidence/`
- `reporters/executive-v3/`
- official inventory and active runtime ledgers in `test-mapping/`
- `docs/smb_priority_templates/` as source templates

### KEEP BUT RELOCATE LATER — structurally valid, physically confusing

- `tests/s1/mx/*` -> logical target `tests/mx/*`
- `tests/s1/pe/qst/*` and `tests/s2/pe/*` -> logical target `tests/pe/*`, after PE generation reconciliation
- `tests/s1/smb/*` -> logical target `tests/shared/*`
- `reporters/*` + `reporter-tests/*` -> logical target under one `reporting/` boundary
- `test-mapping/*` + `mapping-tests/*` -> logical target under one `governance/` boundary
- auth-related scripts/helpers -> one `auth/` or `scripts/auth/` boundary
- CI runners/finalizers -> `scripts/ci/`

These moves are intentionally deferred until references can be changed as one atomic migration and validated. Moving them file-by-file without runtime validation would add risk without business value.

### LEGACY / HISTORICAL — preserve until usage is proven zero

- `tests/s2/pe/dst/**`: established PE/ST2 generation; not safe to delete because package scripts still execute it
- `tests/s2/pe/qst/**`: older PE QST generation; must be reconciled against `tests/s1/pe/qst/**` before removal
- `test-mapping/smb-qst.json`: preserved historical Zephyr campaign, not current P1 denominator
- `test-mapping/mx-s1-qst-runtime.json`: historical/runtime ledger used by reconciliation
- PreQA2 discovery/campaign docs and ledgers
- `fixtures/address.json`, `billingAddress.json`, `card.json`, `customer.json`: still used by PE DST through `utils/testData.js`
- `utils/testData.js`: still used by PE DST guest checkout and therefore not dead
- legacy reconciliation utilities/scripts: governance tooling, not safe to delete by name alone

### DELETE — proven empty placeholders

Removed during this audit:

- `pages/CookiePage.js` — empty file, no implementation
- `docs/test-plan.md` — empty file

## Important non-deletions

### `fixtures/card.json`

Do not confuse the generic versioned PE/DST fixture with the MX runtime test card.

- PE legacy/DST flows still consume `utils/testData.js`, which imports `fixtures/card.json`.
- MX active P1 uses runtime-only `playwright/.auth/mx-test-card.json` via `utils/mxTestCard.js`.

The files serve different generations of automation today. Removing the versioned fixture before PE consolidation would break existing coverage.

### `tests/s2/pe`

This directory looks old beside `tests/s1/pe`, but it still contains the established DST suite and scripts in `package.json` target it directly. It is a migration candidate, not a deletion candidate.

## Canonical logical architecture

The physical repository should converge to this model:

```text
samsung-order-automation/
├── tests/
│   ├── mx/
│   │   ├── qst/
│   │   │   ├── base-store/
│   │   │   ├── epp/
│   │   │   └── backoffice/
│   │   └── dst/
│   │       ├── base-store/
│   │       ├── epp/
│   │       └── backoffice/
│   ├── pe/
│   │   ├── qst/
│   │   └── dst/
│   ├── cl/
│   ├── co/
│   └── shared/
├── pages/
│   ├── shared/
│   ├── mx/
│   ├── pe/
│   └── backoffice/
├── flows/
│   ├── shared/
│   ├── mx/
│   └── pe/
├── config/
│   ├── markets/
│   └── environments/
├── reporting/
│   ├── executive/
│   ├── allure/
│   ├── evidence/
│   └── tests/
├── governance/
│   ├── scope/
│   ├── mapping/
│   ├── reconciliation/
│   └── tests/
├── scripts/
│   ├── auth/
│   ├── ci/
│   ├── reporting/
│   └── governance/
├── docs/
├── Jenkinsfile
├── playwright.config.js
└── package.json
```

## Migration rules

1. S1/S2 are runtime configuration, not a permanent physical taxonomy.
2. Market comes before suite: `tests/<market>/<qst|dst>/<store>`.
3. Shared code must be truly cross-market; market behavior must not be hidden in a generic helper solely to reduce file count.
4. No destructive test is parallelized or retried blindly during refactor.
5. No file is deleted based on name/age alone; imports, npm scripts, Jenkins and governance consumers must be checked first.
6. Runtime result, implementation coverage, official scope and historical evidence remain separate.
7. Each migration should be one concern per commit and be reversible.
8. The MX 29-TC official runner is the regression gate for MX-affecting changes.

## Refactor sequence

### Phase 0 — inventory and zero-risk cleanup

- remove empty placeholders;
- document active vs historical responsibilities;
- correct stale scope documentation;
- add folder-level READMEs so the current hybrid layout is understandable while migration is in progress;
- hide generated/runtime-only clutter in VS Code.

### Phase 1 — documentation and ownership boundaries

- make root README the project entry point only;
- make `docs/README.md` the documentation index;
- mark discovery/historical docs explicitly;
- document which folders are runtime, governance, reporting or compatibility.

### Phase 2 — reporting/governance consolidation

Move reporting and governance code only after package scripts/imports are updated atomically. These changes do not alter business test behavior, but they affect CI/report generation and therefore require reporting tests before merge.

### Phase 3 — test path migration

Migrate environment-first paths to market-first paths. This is the highest-risk structural step because it affects imports, runner discovery, Playwright project matching, Jenkins paths, package scripts and report source paths.

Do not perform this as a cosmetic rename without a runtime gate.

### Phase 4 — PE reconciliation and legacy deletion

Compare `tests/s1/pe/qst` with `tests/s2/pe/qst`, choose the canonical implementation per TC, then remove superseded PE files only after package/Jenkins consumers point to the canonical tree.

### Phase 5 — page/helper decomposition

Large shared Page Objects such as Cart/Checkout should be split only by stable business responsibility, not by arbitrary file size. This comes after path cleanup so import churn happens once.

## Definition of done

The architecture refactor is complete when:

- a new engineer can infer market, suite and store from a test path;
- S1/S2 selection is configuration rather than duplicated folder structure;
- reporting and governance each have one obvious home;
- no empty/dead placeholder remains;
- historical artifacts are clearly marked and do not look like current runtime contracts;
- root README and docs index do not disagree on scope;
- MX S2 official P1 still produces the established baseline or better, with `SAM-25010` remaining a product defect until Samsung fixes it.
