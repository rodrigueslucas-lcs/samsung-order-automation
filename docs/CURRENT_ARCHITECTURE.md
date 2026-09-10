# Current SMB QA Automation Architecture

This document describes the repository after the Zephyr/QST architecture was normalized around the official SMB scope and the live multi-environment validation campaign.

## 1. Authoritative business scope

The official SMB QST scope is the Zephyr baseline tracked in `test-mapping/smb-qst.json`.

| Market | Official TCs |
|---|---:|
| MX | 37 |
| CL | 38 |
| CO | 35 |
| PE | 34 |
| **Total** | **144** |

The 144-case registry is the business denominator. It must not be replaced by the number of Playwright specs, historical DST counts, or the number of currently automated MX cases.

## 2. Runtime validation source of truth

The official Zephyr Expected Result is the acceptance criterion. The correct runtime environment depends on the business flow.

PreQA2 is authoritative only for official scenarios that are actually supported there. The live MX campaign proved that storefront flows such as Home, PLP, PDP, GNB and supported Samsung Account/My Account areas can be validated in PreQA2, while Cart and downstream flows redirect into Staging and therefore must be validated there.

A TC that is not applicable to PreQA2 must not be forced through that environment and must not be called BLOCKED merely because PreQA2 does not host the required flow. It is classified as `NOT_APPLICABLE` for the PreQA2 campaign and handed off to the applicable Staging campaign. The final official runtime result is established in the correct environment.

See [Environment Validation Policy](ENVIRONMENT_VALIDATION_POLICY.md).

The canonical campaign ledger remains `test-mapping/preqa2-validation.json` for the PreQA2 leg after live evidence is safely integrated. Environment handoff metadata must be preserved so Staging execution can close the remaining official cases without rediscovery.

Official validation state and automation implementation coverage are deliberately separate dimensions:

- `PASS`, `FAIL`, `BLOCKED`, `NOT_APPLICABLE` and `NOT_RUN` describe runtime validation in a specific campaign/environment.
- `Full`, `Partial` and `Missing` describe persisted automation coverage.
- A PreQA2 `NOT_APPLICABLE` result does not mean the official TC is complete when the flow is still applicable in Staging.
- Official PASS does not automatically promote automation coverage to Full.

## 3. Current MX environment split

The live campaign established the following current routing for MX:

| Flow family | Current validation environment |
|---|---|
| Home / supported Samsung Account / My Account | PreQA2 |
| PLP / PDP / GNB | PreQA2 |
| Cart / Checkout | Staging |
| Orders / My Orders | Staging |
| Payment / order creation | Authorized Staging only |
| Mobile cart / checkout | Staging |
| BackOffice / fulfillment | Applicable Staging environment |
| EPP | Legitimate market-specific EPP context required |

This is an observed MX routing rule, not a fabricated universal rule for CL/CO/PE. Each market must be verified from official TCs and actual environment behavior.

## 4. Country model

### Mexico

MX currently has the deepest case-level automation metadata through `test-mapping/mx-qst-coverage.json` and the active live campaign. It is the only market where Full/Partial/Missing automation coverage is currently treated as a complete 37-case denominator.

### Peru

PE is part of the same 144-case official campaign. Existing implementation and reuse analysis are represented by `test-mapping/pe-qst-reuse-plan.json` and the country-scoped Playwright implementation. Reuse classification is not the same thing as official PASS or Full automation.

### Chile and Colombia

CL and CO are not future countries in the business model. They are official markets in the 144-case Zephyr scope today.

The repository intentionally does not invent detailed selectors, data, store classification or test titles where official TC metadata has not yet been verified. Shared-family candidates may exist, but case-level automation coverage is not claimed until the official TC is read and runtime evidence is produced.

Therefore:

- CL/CO are present in the official registry, campaign planning, ledger model, closure gates and executive reporting.
- CL/CO may have `Unknown` feature/store metadata for cases that are not yet classified.
- Absence of `tests/<env>/cl/...` or `tests/<env>/co/...` directories does not mean the markets are absent from the architecture; it means country-specific executable implementation has not yet been safely materialized.

## 5. Architecture layers

```text
Official business scope
  test-mapping/smb-qst.json              144 official TCs (MX/CL/CO/PE)

Case metadata / implementation mapping
  test-mapping/mx-qst-coverage.json      MX 37-case automation coverage
  test-mapping/pe-qst-reuse-plan.json    PE implementation/reuse plan
  shared-family metadata                 CL/CO/PE/MX reuse candidates where verified

Environment validation control plane
  PreQA2 campaign                         storefront/applicability validation where supported
  Staging campaigns                       cart/checkout/orders/payment/backoffice where applicable
  environment handoff                     N/A-in-PreQA -> applicable Staging obligation

PreQA2 tooling
  utils/preqa2ExecutionRequirements.js   registered / guest / EPP requirements
  utils/preqa2CampaignPlan.js             market queue and prioritization
  utils/preqa2RuntimeGuard.js             exact PreQA2 host/market guard
  utils/preqa2Validation*.js              canonical PreQA2 ledger validation
  utils/preqa2ClosureGate.js              PreQA2 campaign closure conditions
  utils/preqa2PromotionPlan.js            validation vs automation promotion rules
  scripts/preqa2-*.cjs                    plan, gate, record, merge, closure, reporting

Executable Playwright implementation
  tests/<environment>/<market>/<suite>/<area>/
  pages/
  utils/

Reporting
  reporters/preqa2/                       operational PreQA2 status
  reporters/executive-v3/                 144-scope executive control center
```

## 6. Filesystem convention

Executable tests converge on:

```text
tests/<environment>/<country>/<suite>/<area>/
```

Examples already represented in the repository include MX under S1 and PE under S2. New CL/CO executable directories should only be created when a verified official case has enough real configuration and runtime evidence to justify implementation.

The architecture is wider than the current test-directory tree: the registry and campaign model cover all four markets, while executable code grows market by market and environment by environment.

## 7. Authentication model

WMC authentication and Samsung Account authentication are separate concerns.

PreQA2 bootstrap establishes WMC/PreQA2 access. Registered official TCs additionally require a valid Samsung Account session. The campaign should reuse authenticated state when valid and stop only for actual human-only authentication such as MFA/CAPTCHA/phone approval.

Registered/guest/EPP requirements are encoded per official TC where known. A registered PASS must not be recorded from a guest-only runtime context.

## 8. Safety boundaries

Production is read-only. A PreQA2 or Staging validation must never escape into Production to continue a scenario.

Payment/order submission, profile writes, CronJobs and other destructive actions remain separately guarded and require explicit authorization. Staging is the correct environment for some official flows, but that does not remove destructive-action controls.

## 9. Reporting model

The executive report must keep these dimensions separate:

- Official SMB scope: 144 TCs.
- Market official scope: MX 37, CL 38, CO 35, PE 34.
- PreQA2 runtime result and applicability.
- Staging-required handoff for flows not supported by PreQA2.
- Final official runtime result in the applicable environment.
- MX persisted automation coverage: denominator 37.

The Executive V3 report additionally exposes market/feature views, attention queues, automation gaps, TC drilldown, recent validation, trend snapshots and consistency auditing. It must not fabricate feature/store/environment execution data when no verified metadata exists.

## 10. Integration rule while live campaign is running

Live browser/CDP campaign changes and remote architecture/reporting work may exist on separate branches. Do not resolve the canonical ledger with a blanket `ours` or `theirs` merge. Preserve live runtime evidence first, reconcile the ledger case by case or with merge utilities, preserve environment-routing decisions, then run the full gates and reporting tests locally before declaring the integration official.
