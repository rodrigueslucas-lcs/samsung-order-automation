# Current SMB QA Automation Architecture

This document describes the executable architecture after the repository cleanup and the remaining compatibility debt.

## 1. Authoritative business scope

The business source of truth is the Samsung priority-template model under `docs/smb_priority_templates/`.

| Market | Base Store | EPP | P1 / QST | P2 / DST only | DST total |
|---|---:|---:|---:|---:|---:|
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

P1 runs in QST + DST; P2 runs in DST only. Base Store and EPP remain independent store contexts.

## 2. Proven MX runtime contract

The active MX Base Store runner selects 29 TCs because `SAM-25006` is preserved as an audited exclusion. The stabilized S2 baseline is:

```text
selected=29
executed=29
passed=28
failed=1
blocked=0
notRun=0
```

The only expected current FAIL is `SAM-25010`: Track Order creates the guest order, obtains/accepts OTP, then the current BaseSite cannot resolve the new order.

## 3. Canonical engineer-facing repository

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

config/                 runtime/market configuration
fixtures/               test-data compatibility
flows/                  reusable business flows
pages/                  Page Objects
reporters/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/
test-mapping/
  *.json
  tests/
scripts/                 executable CLIs, still flat
utils/                   runtime/governance helpers
```

The navigation rule is **market -> suite -> store**. Environment is selected at runtime.

## 4. Temporary compatibility layer

`tests/s1/**` and `tests/s2/**` still exist physically because some stable runners, Jenkins commands and relative imports reference them directly. They are hidden from the default VS Code Explorer/search so engineers see the canonical structure first.

Current mirror mapping:

```text
tests/s1/mx   <-> tests/markets/mx
tests/s1/pe   <-> tests/markets/pe
tests/s1/smb  <-> tests/markets/shared
tests/s2/pe   <-> tests/legacy/pe-s2
```

The repository guard checks these mirrors byte-for-byte until runtime cutover is complete:

```bash
npm run repo:architecture:validate
```

This transitional duplication is deliberate: it gives a clean tree immediately while avoiding a risky big-bang change to the official P1 runtime.

## 5. Runtime cutover status

Already using canonical paths:

- MX DST package commands;
- MX fast-guest runner;
- normal VS Code navigation.

Still intentionally using compatibility paths until an atomic migration is runtime-proven:

- MX official P1 runner;
- MX auth-priority project matching;
- some Jenkins direct test commands;
- PE current/legacy runners;
- shared BackOffice/direct SMB commands.

No compatibility tree is deleted until every consumer has moved and the official runner has reproduced the established baseline.

## 6. Reporting and governance ownership

Completed consolidation:

- reporting integrity tests live in `reporters/tests/`;
- governance integrity tests live in `test-mapping/tests/`;
- old root `reporter-tests/` and `mapping-tests/` boundaries are forbidden by the architecture guard.

Renaming `reporters` to `reporting` or `test-mapping` to `governance` is lower priority than runtime-safe test cutover because ownership is already unambiguous.

## 7. PE dual-generation problem

PE still has two generations:

- canonical current view `tests/markets/pe` mirrors the newer `tests/s1/pe` generation;
- `tests/legacy/pe-s2` mirrors the older ST2 generation currently under `tests/s2/pe`.

The older tree contains established DST coverage and an older QST implementation, so it cannot be deleted based on age alone. Reconciliation must be per TC and per runtime consumer.

## 8. Page Object / flow strategy

Current `pages/` remains flat because MX and PE generations share imports. Target ownership remains:

```text
pages/shared
pages/mx
pages/pe
pages/backoffice

flows/shared
flows/mx
flows/pe
```

Move by responsibility/consumer boundary, not file size. This phase comes after test-path cutover so relative imports are not churned twice.

## 9. Script strategy

`scripts/` still mixes auth, CI, reporting and governance commands. Target groups:

```text
scripts/auth
scripts/ci
scripts/reporting
scripts/governance
```

Unlike the test-tree mirror, scripts cannot be copied blindly into one-level-deeper folders because many use `../utils` and sibling-relative imports. Script migration must therefore be an executable move with import/package/Jenkins updates, not a cosmetic duplicate.

## 10. Authentication and payment boundaries

MX auth artifacts are runtime-only under ignored `playwright/.auth/`. MFA/CAPTCHA is never bypassed. The second account is validated only when `SAM-24986` is selected.

Payment data remains intentionally split:

- `fixtures/card.json` — PE/DST compatibility data through `utils/testData.js`;
- `playwright/.auth/mx-test-card.json` — ignored MX runtime data through `utils/mxTestCard.js`.

Do not collapse these until PE migration proves the generic fixture is unused.

## 11. Architecture acceptance

Every phase must preserve:

- official scope gates;
- selected TC inventory;
- destructive guards and zero blind payment retries;
- auth secret handling;
- Executive / Allure / Playwright reporting;
- current MX runtime behavior.

For MX-affecting cutovers the acceptance contract is the official 29-TC campaign. A new automation failure introduced by refactor blocks deletion of the compatibility source.

See `REPOSITORY_AUDIT.md` for completed phases and remaining work.
