# Current SMB QA Automation Architecture

The executable test tree is now **market-first**. S1/S2 are runtime configuration and no longer own physical spec directories.

## Business scope

| Market | Base Store | EPP | P1 / QST | P2 / DST only | DST total |
|---|---:|---:|---:|---:|---:|
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

P1 runs in QST + DST. P2 runs in DST only. Store context and priority remain independent.

MX Base Store has 30 historical/source P1 rows, with `SAM-25006` preserved as an auditable applicability exclusion. The active MX Base Store runner selects 29 TCs.

## Proven MX S2 baseline

```text
selected=29
executed=29
passed=28
failed=1
blocked=0
notRun=0
```

The only current runtime failure is the known `SAM-25010` Track Order defect after successful guest order + OTP flow.

## Physical test architecture

```text
tests/
  markets/
    mx/
      qst/
        base-store/
      dst/
        base-store/
        backoffice/
    pe/
      qst/
        base-store/
      dst/
        base-store/
        epp/
        backoffice/
  shared/
    smb/
      qst/
  legacy/
    pe/
      qst/
```

Canonical paths are defined by `config/testPaths.cjs`.

`mapping-tests/marketFirstPaths.test.cjs` protects the execution contracts against reintroducing `tests/s1` or `tests/s2`.

## Environment routing

- MX S1 -> `stg.shop.samsung.com`
- MX S2 -> `stg2.shop.samsung.com`
- PE routes through `PE_QST_ENVIRONMENT` / market config.

Environment changes endpoints/configuration, not physical ownership.

Do not create duplicate spec trees for S1/S2 when business behavior is equivalent.

## MX ownership

`tests/markets/mx/qst/base-store` is the active 29-TC Base Store P1 implementation.

`tests/markets/mx/dst` retains MX DST coverage and auth/flow helpers that current QST code still reuses. That reuse is now intra-market instead of crossing an environment-named tree.

The official runner keeps authenticated/account-sensitive cases first and the full campaign at one worker until safe parallel isolation is runtime-proven.

## PE ownership

Current regional PE QST lives under:

```text
tests/markets/pe/qst
```

Established PE DST lives under:

```text
tests/markets/pe/dst
```

The older PE/ST2 QST generation is explicitly isolated under:

```text
tests/legacy/pe/qst
```

Legacy npm aliases remain temporarily so old entry points do not disappear silently. Unique coverage must be reconciled before that legacy tree is deleted.

## Shared automation

`tests/shared/smb/qst` is reserved for genuinely cross-market or explicitly market-tagged shared coverage.

Market-specific checkout/payment behavior should remain market-owned instead of being generalized only to reduce file count.

## Page Objects and flows

`pages/` and `flows/` remain compatibility-flat in this phase because moving them would produce large import churn across MX and PE after the test-tree migration.

Target ownership remains:

```text
pages/{shared,mx,pe,backoffice}/
flows/{shared,mx,pe}/
```

These moves should happen by stable business responsibility and only after affected consumers are mapped.

## Reporting

Current reporting implementation remains under `reporters/` with integrity tests under `reporter-tests/`.

Long-term target:

```text
reporting/
  executive/
  allure/
  evidence/
  preqa2/
  tests/
```

This migration is intentionally separate from the test-tree move because Jenkins/package scripts and reporting tests reference the current paths directly.

## Governance

Current scope/mapping/reconciliation is distributed across `test-mapping/`, `mapping-tests/`, governance utilities and scripts.

Long-term target:

```text
governance/
  scope/
  mapping/
  reconciliation/
  tests/
```

The repository already distinguishes official scope, runtime, implementation coverage and historical evidence. Physical governance consolidation must preserve that separation.

## Authentication

Runtime auth state is ignored under `playwright/.auth/`.

Jenkins preflights primary auth and validates the second account only when `SAM-24986` is selected. Interactive MFA/CAPTCHA renewal stays disabled in CI.

## Payment data boundary

- PE compatibility payment data currently still uses versioned `fixtures/card.json` via `utils/testData.js`.
- MX active payment data uses ignored `playwright/.auth/mx-test-card.json` via `utils/mxTestCard.js` and Jenkins Secret file injection.

Do not collapse these until PE payment-data migration is complete.

## CI architecture

Jenkins uses market-first direct paths for diagnostic suites and market-first runner paths for official P1.

The Playwright browser cache is now configured outside `node_modules`; the old global `PLAYWRIGHT_BROWSERS_PATH=0` override was removed because it forced browser downloads into the disposable npm workspace.

Video behavior is unchanged: `screenshots-trace-video` still enables video for the whole selected suite.

## Refactor acceptance

Architecture work is complete only when:

- official scope gates remain valid;
- test discovery selects the expected IDs;
- secret/runtime-only state stays ignored;
- Executive/Allure/Playwright reporting still publishes correctly;
- MX official P1 preserves the established functional baseline, with `SAM-25010` remaining a real defect until the product is fixed.

Code movement alone is not runtime proof.
