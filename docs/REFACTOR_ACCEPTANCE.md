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

Physical deletion is deliberately a second gate, not part of the structural cutover itself.

1. `tests/s1/mx` is deletable only after the canonical-path MX S2 29-TC Jenkins acceptance passes and temporary Playwright compatibility matching is no longer needed.
2. `tests/s1/pe`, `tests/s1/smb` and `tests/s2/pe` require their relevant consumer/runtime acceptance; do not delete PE legacy DST merely because its folder is old.
3. `reporters/` is deletable only when `npm run repo:legacy:audit:strict` has no reporting compatibility consumers and reporting integrity tests pass from `reporting/`.
4. `test-mapping/` is deletable only when the same strict audit has no governance compatibility consumers and governance/reporting tests read only from `governance/`.
5. After physical deletion, remove obsolete mirror-validator pairs and VS Code hide rules that mention roots which no longer exist.

## Non-negotiable behavior

- Do not convert the known Track Order defect into a PASS.
- Do not weaken business assertions merely to survive the refactor.
- Do not create a second environment-specific MX tree; S1/S2 remain runtime configuration.
- Prefer small reversible commits. If a structural step changes runtime behavior, stop and roll back before proceeding.
