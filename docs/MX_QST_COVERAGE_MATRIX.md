# MX QST — Current Coverage and Runner Model

This document describes the current MX QST execution model.

## Official MX scope

MX contains **92 official priority rows** across Base Store and EPP:

| Store | P1 / QST source rows | P2 / DST only | Total |
|---|---:|---:|---:|
| Base Store | 30 | 26 | 56 |
| EPP | 8 | 28 | 36 |
| **MX** | **38** | **54** | **92** |

The historical/official Base Store source contains 30 P1 rows. `SAM-25006` is currently excluded from active MX automation because Samsung SMB QA clarified that the PSE bank-payment path in that inherited test data is Colombia-specific and is not a valid MX payment path.

Therefore the **active Base Store QST runner selects 29 TCs**. The exclusion remains visible for audit; it is not silently removed from source history.

## S1 / S2 parity

The same active 29 Base Store P1 cases are used for:

- **S1/STG** — `stg.shop.samsung.com`
- **S2/STG2** — `stg2.shop.samsung.com`

Environment selection changes configuration/endpoints, not the active case inventory. Specs are not duplicated merely to represent S1 versus S2.

## Active MX Base Store P1 IDs

```text
24962, 24963, 24964, 24968, 24969, 24971, 24972, 24975,
24981, 24982, 24985, 24986, 24988, 24989, 24990, 24991,
24992, 24993, 24994, 24995, 24999, 25000, 25001, 25002,
25004, 25005, 25010, 25011, 25016
```

Audit exclusion:

```text
SAM-25006 — source P1 row preserved; inactive for MX until a valid MX-specific Rewards/payment path is defined.
```

The active runner/gate must reconcile to **29/29** before a full Base Store P1 campaign is treated as valid.

## Proven MX S2 baseline

Current stabilized official Base Store execution:

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

`SAM-25010` reaches the intended flow: guest order creation succeeds, OTP request returns success and verification is accepted, but the current BaseSite cannot resolve the newly created order. Preserve that failure/evidence until the product/environment behavior is fixed.

## FAST guest-safe subset

The FAST guest-safe campaign is a non-destructive subset for quick environment/pipeline validation.

```text
24971, 24972, 24975, 24981, 24982, 24988, 24989,
24990, 24995, 24999, 25001, 25004, 25005, 25016
```

FAST does not replace the official active 29-TC P1 campaign.

## Runtime status versus coverage

Keep these dimensions separate:

- **Official source scope** — Samsung priority inventory;
- **Active runner scope** — source rows currently applicable/executable for MX;
- **Runtime result** — what happened in this build;
- **Automation coverage** — implementation maturity.

A prior PASS does not guarantee a future build. Full implementation does not create a runtime PASS.

## Registered and destructive flows

Registered execution requires valid environment-specific Samsung Account state.

The authenticated fixture validates persisted state before registered flows continue. Recoverable local expiry may use one controlled renewal; Jenkins interactive auto-renew remains disabled by default. MFA/CAPTCHA is never bypassed.

Payment/order scenarios require explicit non-Production authorization:

```text
ALLOW_PAYMENT_SUBMIT=1
```

Never blindly retry an ambiguous payment/order submit.

## Targeted stabilization

Jenkins can execute selected active official P1 IDs through `P1_TARGET_IDS`, for example:

```text
SAM-24969,SAM-24991,SAM-25002
```

The targeted lane reuses the same runner, credentials, safety guards and reporting stack; it is for stabilization/debugging and does not redefine official scope.

## Commands

Full active Base Store campaign:

```bash
npm run qst:mx:base-store
```

List/discovery:

```bash
npm run qst:mx:list
```

FAST guest-safe:

```bash
npm run qst:mx:fast
```

FAST list:

```bash
npm run qst:mx:fast:list
```

`MX_QST_ENVIRONMENT=S1` or `S2` selects runtime environment for direct/local execution.

## Reporting

1. Executive Dashboard — build health/presentation.
2. Allure — SAM/Jira-oriented technical evidence.
3. Playwright / Trace Viewer — low-level investigation.
4. Jenkins — orchestration, gates and publication.

Historical ledgers/campaign inventories remain available for traceability but do not overwrite current runtime results.
