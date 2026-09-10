# Environment Validation Policy

This document records the current runtime rule discovered during the live SMB QST campaign: the official 144-case business scope spans more than one non-Production validation environment.

## Core rule

The official Zephyr Expected Result remains the acceptance criterion, but the correct execution environment depends on the business flow.

PreQA2 is authoritative for storefront scenarios that are actually supported there. When a flow is not supported by PreQA2 and the application redirects into Staging/S1/ST2, the case must not be forced through PreQA2 and must not be called BLOCKED merely because PreQA2 does not host that business capability.

Instead, classify the PreQA2 attempt as not applicable for that environment and route the TC to the correct staging campaign.

## Current MX routing observed in the live campaign

The current live MX campaign established this working split:

| Flow family | Environment rule |
|---|---|
| Home / Samsung Account / My Account areas available in PreQA2 | Validate in PreQA2 |
| PLP / PDP / GNB storefront behavior available in PreQA2 | Validate in PreQA2 |
| Cart and downstream checkout flow | Validate in Staging, not PreQA2 |
| Orders / My Orders | Validate in Staging where controlled orders exist |
| Payment / order submission | Validate only in authorized Staging with destructive guards |
| Mobile cart / checkout | Validate in Staging when it depends on the cart/checkout path |
| BackOffice / fulfillment | Validate in the appropriate Staging environment |
| EPP | Requires legitimate EPP context for the market; do not infer from Base Store |

This routing is based on observed environment behavior. It may evolve per market when CL, CO and PE official cases are executed and their actual environment support is verified.

## Status semantics

Do not conflate environment applicability with product failure.

- `PASS`: the official Expected Result was proven in the correct environment with runtime evidence.
- `FAIL`: the official Expected Result was exercised in the correct environment and was not met.
- `BLOCKED`: the correct environment is applicable, but a real dependency prevents execution.
- `NOT_APPLICABLE`: the TC is not valid in the environment currently being evaluated and must be routed elsewhere when the official flow still applies.
- `NOT_RUN`: the TC has not yet been executed in its applicable environment.

A PreQA2 `NOT_APPLICABLE` result for a Cart/Checkout/Orders case does **not** close the official TC. It closes only the PreQA2 applicability decision and creates a staging validation obligation.

## Environment handoff rule

For every TC routed out of PreQA2, preserve enough metadata to continue without rediscovery:

- official TC ID;
- market;
- feature/store;
- reason PreQA2 is not applicable;
- target environment when verified;
- required account context (guest/registered);
- EPP requirement if applicable;
- destructive/safety requirement;
- staging prerequisite such as controlled cart, address or order;
- current automation implementation state.

The staging result becomes the official runtime result for that TC when the official Expected Result is proven there.

## Safety

Production remains read-only and is never an alternative validation environment.

A redirect from PreQA2 to Production must be blocked. It is evidence about environment behavior, not permission to continue the scenario in Production.

Payment/order submit, CronJobs, profile writes and other destructive operations remain separately guarded and require explicit authorization.

## Reporting requirement

Executive and operational reports must distinguish:

1. official business scope;
2. PreQA2 execution status;
3. staging-required handoff;
4. final official runtime result;
5. automation implementation coverage.

This prevents `NOT_APPLICABLE in PreQA2` from being misread as `officially complete`, and prevents a Staging-required flow from being misreported as a PreQA2 blocker.
