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

The baseline defines the behavior to preserve. Jenkins Build #52 runtime-validated the canonical MX cutover on commit `359bedb`: 29 selected, 29 executed, 28 PASS, 1 known FAIL (`SAM-25010`), 0 blocked and 0 not-run.

## Rollback point

Before the final compatibility cleanup, the branch was snapshotted at:

```text
backup/pre-final-architecture-cleanup-20260925
1c4887046430c8841fe335ca3f9ae9cb31ff2273
```

If the final canonical-only cleanup introduces a structural regression, restore from that branch or revert the individual cleanup commits. Do not patch business tests merely to recover a green build.

## Static gate

After pulling the branch and installing dependencies, the full structural acceptance is one command:

```bash
npm ci
npm run repo:refactor:gate
```

`repo:refactor:gate` stops on the first failure and executes, in order:

1. repository architecture validation;
2. strict legacy-consumer audit;
3. PE generation audit;
4. official SMB scope gate;
5. MX S2 official P1 discovery;
6. governance integrity tests;
7. Executive V2 reporting integrity tests;
8. MX runtime / Executive V3 reporting integrity tests.

Expected properties:

- canonical test navigation is `tests/markets/...`;
- historical PE S2 automation is explicit under `tests/legacy/pe-s2/...`;
- active production entry points do not depend on `tests/s1`, `tests/s2`, `reporters/` or `test-mapping/`;
- `repo:legacy:audit:strict` reports zero actionable runtime/code/data consumers before any compatibility root is physically deleted;
- compatibility drift is diagnostic while rollback copies remain frozen; canonical trees are authoritative and are not expected to remain byte-identical to frozen copies;
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

## Physical deletion policy

Physical deletion remains evidence-driven.

1. `tests/s1/mx` was deleted after Jenkins Build #52 proved the canonical MX S2 29-TC runtime contract; temporary dual Playwright matching was removed with it.
2. `reporters/` and `test-mapping/` were deleted after active consumers had already moved to `reporting/` and `governance/`, the strict consumer audit had no actionable compatibility consumers, and Build #52 successfully generated/published the canonical reports.
3. `tests/s1/pe`, `tests/s1/smb` and `tests/s2/pe` remain protected until their relevant PE/shared consumer/runtime acceptance is complete; do not delete PE legacy DST merely because its folder is old.
4. Mirror validation and VS Code exclusions now cover only compatibility roots that still physically exist.

## Non-negotiable behavior

- Do not convert the known Track Order defect into a PASS.
- Do not weaken business assertions merely to survive the refactor.
- Do not create a second environment-specific MX tree; S1/S2 remain runtime configuration.
- Prefer small reversible commits. If a structural step changes runtime behavior, stop and roll back before proceeding.
