# Current SMB QA Automation Architecture

This document describes the engineer-facing repository contract after the canonical test-tree cleanup.

## 1. Navigation rule

The repository follows one test navigation rule:

```text
market -> suite -> store
```

Environment (`S1` / `S2`) is runtime configuration. It is not a source-tree taxonomy.

## 2. Canonical test tree

The conceptual suite order is always **QST first, DST second**:

```text
tests/
  markets/
    mx/
      qst/
        base-store/
        epp/
      dst/
        base-store/
        backoffice/
    pe/
      qst/
        base-store/
        epp/
      dst/
        base-store/
        epp/
        backoffice/
    co/
      qst/
        base-store/
        epp/
      dst/
        README.md
    cl/
      qst/
        base-store/
        epp/
      dst/
        README.md
    shared/
      qst/
        base-store/
        backoffice/
```

`tests/markets` is authoritative. The old `tests/s1`, `tests/s2` and `tests/legacy` compatibility roots are removed and must not return.

Every market exposes the same top-level suite contract: `qst/` and `dst/`. A DST root may be structural-only when that market does not yet have official implemented DST browser coverage. Structural presence must never be interpreted as runtime PASS or implemented coverage.

The repository contract treats QST as the primary suite and DST as the secondary suite. File explorers may render `dst` before `qst` because of alphabetical sorting; folder names are not prefixed with artificial numbers only to control UI ordering.

At each market root, only `qst/` and `dst/` are allowed. At each market QST root, only `base-store/` and `epp/` are allowed. Reusable flow modules do not belong loose at these ownership levels.

## 3. Market ownership

### MX

MX owns current QST Base Store/EPP plus canonical DST Base Store/BackOffice automation.

### PE

PE owns both current QST and established DST coverage. The previous `tests/legacy/pe-s2/dst` generation was migrated without changing its file contents into `tests/markets/pe/dst` so active DST commands no longer depend on a legacy path.

### CO

CO QST is physically separated into Base Store and EPP. `tests/markets/co/dst` is a reserved canonical suite boundary only; it does not claim implemented CO DST coverage yet.

### CL

CL QST is physically separated into Base Store and EPP. The official plan remains 38 TCs: 31 Base Store and 7 EPP. `scripts/run-cl-qst-p1.cjs` selects the physical store path from `CL_QST_STORE` and still supports the combined official campaign. `tests/markets/cl/dst` is a reserved canonical suite boundary only; it does not claim implemented CL DST coverage yet.

CL reusable storefront/cart flow logic lives under `flows/cl/qstFlows.js`, not inside the QST ownership root.

## 4. Shared ownership

`tests/markets/shared` is for genuinely reusable executable behavior. It must not become a second executable owner of a market's official SAM ID.

Reusable browser/business implementation belongs under `flows/`; market-specific reusable behavior belongs under `flows/<market>/`, while genuinely cross-market behavior may live under a shared SMB flow boundary.

One official SAM ID has one executable ownership location per market.

## 5. Runtime configuration

Market runners select environment through runtime variables such as:

```text
MX_QST_ENVIRONMENT
PE_QST_ENVIRONMENT
CO_QST_ENVIRONMENT
CL_QST_ENVIRONMENT
```

Do not create new `tests/s1` or `tests/s2` trees.

## 6. Operator surface

Primary QST commands:

```text
npm run qst:mx:base-store
npm run qst:pe:base-store
npm run qst:co:base-store
npm run qst:co:epp
npm run qst:cl:base-store
npm run qst:cl:epp
```

Discovery/list commands are non-destructive and should be used before broad runtime after structural changes.

PE DST commands resolve canonical paths under `tests/markets/pe/dst`.

## 7. Authentication / Jenkins boundary

Authentication is runtime state, never source ownership.

The market lifecycle is conceptually:

```text
refresh -> verify -> package -> install -> optional Jenkins publish
```

CL has the same Jenkins session-bundle publishing surface as MX/PE/CO through `auth:publish:jenkins:cl`. The publisher validates the CL bundle and publishes the protected file credential without printing session material.

CAPTCHA/MFA remains a legitimate human security boundary and is never bypassed.

## 8. Safety contract

Payment/order/profile mutations remain guarded. Production is not a fallback. Ambiguous order/payment submission is never blindly retried.

PASS, FAIL, BLOCKED, KNOWN BUG and NOT_RUN remain distinct reporting states.

## 9. Architecture gates

Structural changes must preserve:

```bash
npm run repo:architecture:validate
npm run qst:official:gate
npm run qst:steps:gate
npm run repo:refactor:gate
```

The architecture validator rejects resurrection of `tests/s1`, `tests/s2` or `tests/legacy`, requires canonical QST/DST suite boundaries for MX, PE, CO and CL, and rejects loose files at market/QST ownership roots.

Static/discovery acceptance is not storefront runtime proof. Runtime acceptance must be reported separately.

## 10. Engineer handoff model

A new QA should be able to understand the repository from the tree alone:

```text
country
  -> QST
      -> Base Store / EPP
  -> DST
      -> Base Store / EPP / BackOffice when implemented
```

Root `README.md` remains the operator entry point. Detailed documentation belongs under `docs/`; test folders should not accumulate competing onboarding READMEs except structural placeholders that explicitly prevent false coverage claims.
