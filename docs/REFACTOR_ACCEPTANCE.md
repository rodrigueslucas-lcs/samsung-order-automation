# Refactor Acceptance Gate

This is the checkpoint between structural cleanup and physical deletion of compatibility code.

## Proven runtime baseline (before canonical-path cutover)

```text
MX S2 official Base Store P1
selected=29
executed=29
passed=28
failed=1     # SAM-25010 known Track Order product/environment defect
blocked=0
notRun=0
```

The baseline proves the behavior we must preserve. It does **not** runtime-validate the current refactor HEAD.

## Static gate

After pulling the branch, run:

```bash
npm ci
npm run repo:architecture:validate
npm run repo:legacy:audit
npm run repo:pe:audit
npm run qst:official:gate
npm run qst:mx:list
npm run reporting:mx-runtime:test
```

Expected properties:

- canonical test navigation is `tests/markets/...`;
- compatibility mirrors have zero drift;
- active production entry points do not depend on `tests/s1`, `tests/s2`, `reporters/` or `test-mapping/`;
- MX discovery still selects exactly 29 active Base Store P1 TCs;
- official SMB gate remains 362 = 144 P1/QST + 218 P2/DST-only.

## Runtime gate

Refresh/verify MX credentials, upload the same artifacts to Jenkins, then execute:

```text
MARKET=MX
ENVIRONMENT=S2
TEST_SUITE=official-p1
EXECUTION_MODE=authorized-destructive
BROWSER_MODE=headless
EVIDENCE_MODE=screenshots-trace-video
P1_TARGET_IDS=<empty>
```

Acceptance contract:

```text
selected=29
executed=29
blocked=0
notRun=0
no new automation failures
```

`SAM-25010` may remain the single FAIL only if the already-proven flow still creates the guest order, obtains/accepts OTP and then the current BaseSite cannot resolve the order.

## What becomes deletable after PASS

Only after the runtime gate passes:

1. delete `tests/s1/mx` after removing the temporary dual Playwright auth-priority match;
2. delete other hidden test mirrors only when their own active consumers are canonical and their relevant runtime has been accepted;
3. delete `reporters/` only after `npm run repo:legacy:audit:strict` shows no runtime/code consumers and reporting acceptance is intact;
4. delete `test-mapping/` under the same consumer/acceptance rule;
5. then decompose `scripts/`, `pages/` and `flows/` by responsibility so import churn does not overlap this highest-risk discovery cutover.

Do not convert the known Track Order defect into a PASS, and do not delete PE legacy DST merely because its folder is old.
