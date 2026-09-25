# Current SMB QA Automation Architecture

This document describes the executable architecture after the repository cleanup. Runtime behavior is stabilized; physical test ownership is now market-first instead of environment-first.

## 1. Authoritative business scope

| Market | Base Store | EPP | P1 / QST | P2 / DST only | DST total |
|---|---:|---:|---:|---:|---:|
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

P1 runs in QST + DST; P2 runs in DST only. Base Store and EPP remain separate contexts.

`test-mapping/smb-qst.json` is preserved historical Zephyr traceability and is not the current priority denominator.

## 2. Active MX execution model

MX has 38 P1 rows overall. The historical Base Store source contains 30 P1 rows, but `SAM-25006` is excluded from active MX execution because the inherited PSE path is Colombia-specific rather than a valid MX payment path.

The active MX Base Store runner therefore executes **29 TCs** on either S1/STG or S2/STG2. Environment selection changes configuration/endpoints, not test ownership or active inventory.

## 3. Proven runtime baseline

The last runtime-proven MX S2 baseline, from the pre-refactor stable branch, is:

```text
selected=29
executed=29
passed=28
failed=1
blocked=0
notRun=0
```

The only FAIL is `SAM-25010`: guest Track Order creates an order, receives/accepts OTP, then the current BaseSite cannot resolve the order. The framework preserves that product defect.

The market-first branch is **code-refactored but not yet Jenkins runtime-proven**. That distinction is intentional.

## 4. Current physical repository

```text
config/                 market/runtime configuration
fixtures/               compatibility data; PE non-payment data is namespaced
flows/                  reusable storefront/business flows
pages/                  Page Objects (shared + market-specific still flat)
reporters/
  evidence/
  executive/
  executive-v3/
  preqa2/
  tests/                 reporting integrity tests
scripts/                 auth + execution + reporting + governance CLIs (still flat)
test-mapping/
  *.json                  scope/mapping/runtime/governance data
  tests/                  governance integrity tests
tests/
  markets/
    mx/{qst,dst}/         canonical MX automation
    pe/{qst,dst}/         canonical PE stabilization + DST
  shared/
    smb/qst/              shared/regional automation
  legacy/
    pe/qst/               older PE QST compatibility generation
utils/                   runtime + governance helpers still mixed
```

## 5. Structural rule

**Market/suite/store are physical ownership. S1/S2 are runtime configuration.**

Canonical executable path:

```text
tests/markets/<market>/<qst|dst>/<store>/
```

Shared code:

```text
tests/shared/...
```

Explicit compatibility generations:

```text
tests/legacy/...
```

There are no canonical `tests/s1` or `tests/s2` trees anymore.

## 6. Why `tests/markets` exists instead of `tests/<market>`

The extra `markets/` ownership segment keeps the same directory depth as the historical `s1/<market>` / `s2/<market>` layout. That lets existing relative imports keep their depth while removing environment ownership from the tree. It reduces refactor risk without compromising clarity.

## 7. PE dual-generation handling

PE is now explicit instead of visually ambiguous:

- `tests/markets/pe/qst` — newer/canonical PE QST stabilization generation;
- `tests/markets/pe/dst` — established PE DST generation;
- `tests/legacy/pe/qst` — older PE QST generation awaiting per-TC reconciliation.

Folder age alone is not enough evidence to delete the legacy generation. Reconcile first, then delete superseded TCs.

## 8. Page Object strategy

Page Objects remain flat temporarily because MX and PE implementations still share imports. Target ownership remains:

```text
pages/shared/
pages/mx/
pages/pe/
pages/backoffice/
```

Do not split solely by file size; split by stable responsibility and consumer boundary.

## 9. Authentication model

MX registered execution uses environment-specific persisted state under ignored `playwright/.auth/`.

- local auto-renew enabled unless `MX_AUTH_AUTO_RENEW=0`;
- Jenkins auto-renew disabled unless explicitly enabled;
- MFA/CAPTCHA is never bypassed;
- failed renewal stays a failure/blocker;
- second-account state is validated only when `SAM-24986` is selected.

## 10. Payment data boundary

Two mechanisms coexist:

- the versioned generic card fixture remains a PE/DST compatibility dependency through `utils/testData.js`;
- `playwright/.auth/mx-test-card.json` is runtime-only MX data consumed by `utils/mxTestCard.js`.

Do not collapse them until PE payment-data migration is proven.

## 11. Reporting / governance ownership

Reporting implementation and integrity tests live together under `reporters/`.

Governance data and integrity tests live together under `test-mapping/`.

This removed the old root `reporter-tests/` and `mapping-tests/` splits.

## 12. Remaining cleanup

The next structural candidates are lower priority than the test tree migration:

```text
scripts/{auth,ci,reporting,governance}/
pages/{shared,mx,pe,backoffice}/
flows/{shared,mx,pe}/
```

Those moves should happen only after the market-first branch passes structural/list gates, so the same import/caller is not churned multiple times before validation.

## 13. Structural gate

Run:

```bash
npm run repo:architecture:validate
```

It checks required boundaries, rejects resurrected `tests/s1` / `tests/s2` trees and scans runtime configuration/code for stale environment-first test references.

## 14. Refactor acceptance

Every architecture phase must preserve:

- official scope gates;
- runner selection correctness;
- auth/secret paths;
- reporting generation;
- current MX behavior;
- destructive safety guards.

For MX-affecting changes, the final acceptance gate is the official 29-TC campaign. Until that Jenkins run is executed, this branch is **CODE COMMITTED / STATICALLY REFACTORED**, not runtime validated.
