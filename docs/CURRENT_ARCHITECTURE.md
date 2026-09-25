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

The active MX Base Store runner selects 29 TCs because `SAM-25006` is preserved as an audited exclusion. Last proven pre-cutover S2 baseline:

```text
selected=29
executed=29
passed=28
failed=1
blocked=0
notRun=0
```

The only expected current FAIL is `SAM-25010`: Track Order creates the guest order, obtains/accepts OTP, then the current BaseSite cannot resolve the new order.

The structural cutover described below is **code-complete but still requires a post-refactor Jenkins acceptance run** before compatibility trees are physically deleted.

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
scripts/                executable CLIs, staged for responsibility split
utils/                  runtime/governance helpers
```

The navigation rule is **market -> suite -> store**. Environment is selected at runtime and is no longer an engineer-facing test taxonomy.

## 4. Temporary compatibility layer

Hidden compatibility roots remain only as rollback/runtime-acceptance safety nets:

```text
tests/s1/mx      <-> tests/markets/mx
tests/s1/pe      <-> tests/markets/pe
tests/s1/smb     <-> tests/markets/shared
tests/s2/pe      <-> tests/legacy/pe-s2
reporters/        <-> reporting/
test-mapping/     <-> governance/
```

VS Code hides compatibility roots by default. The architecture gate checks mirrored pairs byte-for-byte:

```bash
npm run repo:architecture:validate
```

The duplication is transitional and deliberate: active consumers have moved to canonical boundaries, but physical deletion waits for runtime acceptance.

## 5. Runtime cutover status

Canonical paths are now used by the active execution surface:

- MX official P1 runner;
- MX fast-guest runner;
- MX DST package commands;
- Jenkins direct MX authenticated-safe and BackOffice-safe lanes;
- PE current P1 runner;
- PE/shared direct package commands;
- package reporting/governance integrity commands;
- Playwright evidence reporter;
- normal VS Code navigation.

The architecture validator now rejects regressions where active CI/runners point back to `tests/s1`, `tests/s2`, `reporters/` or `test-mapping/`.

Playwright auth-priority matching temporarily accepts both compatibility and canonical MX paths until the first official post-cutover campaign is proven. This protects the registered subset against accidental discovery loss during the migration window.

After the acceptance run reproduces the 29-executed baseline with no new automation failures, the compatibility-only roots can be deleted and the dual Playwright match removed.

## 6. Reporting and governance ownership

Canonical boundaries are:

```text
reporting/
governance/
```

The hidden `reporters/` and `test-mapping/` trees are compatibility mirrors only. Root `reporter-tests/` and `mapping-tests/` were already removed; integrity tests live inside canonical ownership (`reporting/tests`, `governance/tests`).

Active package/reporting commands and the MX/PE runners are being resolved through the canonical ownership boundary. Runtime result, automation coverage, official scope and historical evidence remain separate dimensions.

## 7. PE dual-generation problem

PE still has two generations:

- `tests/markets/pe` — canonical current/newer PE QST stabilization generation;
- `tests/legacy/pe-s2` — explicit older ST2 generation containing older QST plus established DST coverage.

The older tree cannot be deleted based on age. Reconciliation is per TC and per runtime consumer.

## 8. Page Object / flow strategy

`pages/` remains flat while MX and PE generations share imports. Target ownership:

```text
pages/shared
pages/mx
pages/pe
pages/backoffice

flows/shared
flows/mx
flows/pe
```

Move by responsibility/consumer boundary after the test-path acceptance checkpoint so import churn does not overlap the highest-risk runner cutover.

## 9. Script strategy

`scripts/` still mixes auth, execution, reporting and governance commands. Target:

```text
scripts/auth
scripts/ci
scripts/reporting
scripts/governance
```

Script decomposition is the next structural phase after runtime acceptance. Current executable paths remain stable so auth and Jenkins behavior are not simultaneously changed with the test-tree cutover.

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

For the MX path cutover, acceptance is the official S2 29-TC campaign reproducing the established baseline: 29 executed, no blocked/not-run caused by architecture, and no new automation failure beyond the known product defect while it remains reproducible.

See `REPOSITORY_AUDIT.md` for completed phases and deletion gates.
