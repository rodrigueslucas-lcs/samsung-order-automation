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

The active MX Base Store runner selects 29 TCs because `SAM-25006` is preserved as an audited exclusion. Stabilized S2 baseline:

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

reporting/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/

governance/
  *.json
  tests/

config/                 runtime/market configuration
fixtures/               test-data compatibility
flows/                  reusable business flows
pages/                  Page Objects
scripts/                executable CLIs, still flat
utils/                  runtime/governance helpers
```

The navigation rule is **market -> suite -> store**. Environment is selected at runtime.

## 4. Temporary compatibility layer

Hidden compatibility roots still exist because some stable runners/Jenkins commands/imports reference them directly:

```text
tests/s1/mx      <-> tests/markets/mx
tests/s1/pe      <-> tests/markets/pe
tests/s1/smb     <-> tests/markets/shared
tests/s2/pe      <-> tests/legacy/pe-s2
reporters/        <-> reporting/
test-mapping/     <-> governance/
```

VS Code hides compatibility roots by default. The architecture gate checks all mirrored pairs byte-for-byte:

```bash
npm run repo:architecture:validate
```

The duplication is transitional and deliberate: clean navigation now, deletion only after consumer cutover and runtime proof.

## 5. Runtime cutover status

Already using canonical paths in active consumers:

- MX DST package commands;
- MX fast-guest runner;
- PE current P1 runner;
- PE/shared direct package commands;
- package reporting/governance integrity commands;
- Playwright evidence reporter;
- normal VS Code navigation.

Still intentionally using compatibility paths where a risky big-bang edit would threaten the proven MX runner:

- MX official P1 runner path;
- some Jenkins direct MX safe-lane paths;
- selected scripts/utilities that still resolve `reporters/` or `test-mapping/`.

Playwright auth-priority matching accepts both old and canonical MX paths during cutover so the registered subset cannot silently disappear.

No compatibility tree is deleted until every consumer has moved and the official runner has reproduced the established baseline.

## 6. Reporting and governance ownership

Canonical boundaries are now:

```text
reporting/
governance/
```

The hidden `reporters/` and `test-mapping/` trees are compatibility mirrors only. Root `reporter-tests/` and `mapping-tests/` were already removed; integrity tests are inside the canonical ownership boundary (`reporting/tests`, `governance/tests`).

Runtime result, automation coverage, official scope and historical evidence remain separate dimensions.

## 7. PE dual-generation problem

PE still has two generations:

- `tests/markets/pe` — canonical current/newer PE QST stabilization generation;
- `tests/legacy/pe-s2` — explicit older ST2 generation containing older QST plus established DST coverage.

The older tree cannot be deleted based on age. Reconciliation is per TC and per runtime consumer.

## 8. Page Object / flow strategy

`pages/` remains flat because MX and PE generations share imports. Target ownership:

```text
pages/shared
pages/mx
pages/pe
pages/backoffice

flows/shared
flows/mx
flows/pe
```

Move by responsibility/consumer boundary, not file size. Do this after test-path cutover so imports are not churned twice.

## 9. Script strategy

`scripts/` still mixes auth, execution, reporting and governance commands. Target:

```text
scripts/auth
scripts/ci
scripts/reporting
scripts/governance
```

Scripts cannot be cosmetically mirrored into deeper folders because many use `../utils` and sibling-relative paths. Their migration must update every executable caller atomically.

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
