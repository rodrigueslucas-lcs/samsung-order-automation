# MX QST — Current Coverage and Runner Model

This document describes the current MX QST execution model. It replaces the older 22-scenario S1-only progress snapshot that previously lived here.

## Official MX scope

MX contains **92 official priority rows** across Base Store and EPP:

| Store | P1 / QST | P2 / DST only | Total |
|---|---:|---:|---:|
| Base Store | 30 | 26 | 56 |
| EPP | 8 | 28 | 36 |
| **MX** | **38** | **54** | **92** |

For the active Base Store QST campaign, the official runner selects **30 P1 TCs**.

## S1 / S2 parity

The same 30 Base Store P1 cases are used for:

- **S1/STG** — `stg.shop.samsung.com`
- **S2/STG2** — `stg2.shop.samsung.com`

The environment changes configuration and endpoints, not the case inventory. Specs are not duplicated only to represent S1 versus S2.

## Official MX Base Store P1 IDs

```text
24962, 24963, 24964, 24968, 24969, 24971, 24972, 24975,
24981, 24982, 24985, 24986, 24988, 24989, 24990, 24991,
24992, 24993, 24994, 24995, 24999, 25000, 25001, 25002,
25004, 25005, 25006, 25010, 25011, 25016
```

The official gate and list command must reconcile to 30/30 before the complete Base Store P1 campaign is treated as valid.

## FAST guest-safe subset

The FAST guest-safe campaign is a non-destructive subset intended for quick environment/pipeline validation.

Current guest-safe IDs:

```text
24971, 24972, 24975, 24981, 24982, 24988, 24989,
24990, 24995, 24999, 25001, 25004, 25005, 25016
```

This subset does not replace the official 30-TC P1 campaign.

## Runtime status versus coverage

Three concepts must remain separate:

- **Official scope** — the current Samsung priority inventory.
- **Runtime result** — what actually happened in a specific S1/S2 build.
- **Automation coverage** — Full / Partial / Missing implementation maturity retained by mapping/reporting layers.

A prior PASS does not guarantee the next environment/build will PASS. A Partial/Full mapping does not create a runtime result.

## Registered and destructive flows

Registered-user execution requires valid environment-specific Samsung Account state.

The MX authenticated fixture:

1. loads the persisted state;
2. validates that the current session is usable;
3. for recoverable expiry, may perform one controlled renewal;
4. reloads the refreshed state into the current Playwright context;
5. proves authentication before continuing.

CI auto-renew is opt-in with `MX_AUTH_AUTO_RENEW=1`. MFA/CAPTCHA is never bypassed.

Payment/order scenarios require explicit non-Production authorization such as:

```text
ALLOW_PAYMENT_SUBMIT=1
```

They must use controlled execution and must not blindly retry after an ambiguous submit.

## Environment defects

Tests must not be weakened merely to make S1/S2 green.

When automation reaches the intended business state and the environment/backend fails the expected behavior, preserve the failure and evidence as an environment/functional defect.

Examples of current stabilization principles include:

- use causal API/UI evidence rather than waiting on a navigation that can be replaced by a maintenance/system-check page;
- explicitly prove registered address selection before continuing checkout;
- preserve order/tracking failures when the environment cannot find a newly created order after successful verification;
- distinguish authentication expiry from product/test-data/backend defects.

## Commands

Official Base Store campaign:

```bash
npm run qst:mx:base-store
```

List/discovery only:

```bash
npm run qst:mx:list
```

FAST guest-safe campaign:

```bash
npm run qst:mx:fast
```

FAST list only:

```bash
npm run qst:mx:fast:list
```

Set the environment using the runner/Jenkins configuration. For direct isolated Playwright diagnostics, `MX_QST_ENVIRONMENT=S1` or `S2` selects the target configuration.

## Reporting

MX execution feeds the final reporting stack:

1. Executive Dashboard — build health and presentation.
2. Allure — SAM/Jira-oriented technical evidence.
3. Playwright report / Trace Viewer — low-level investigation.
4. Jenkins Stage View — orchestration and report production.

Historical regional ledgers and old campaign inventories are preserved for traceability but do not replace the current official priority model.
