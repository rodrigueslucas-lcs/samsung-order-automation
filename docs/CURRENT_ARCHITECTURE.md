# Current SMB QA Automation Architecture

This document describes the repository as it operates after the Zephyr/QST architecture was normalized around the official SMB scope and the PreQA2 validation campaign.

## 1. Authoritative business scope

The official SMB QST scope is the Zephyr baseline tracked in `test-mapping/smb-qst.json`.

| Market | Official TCs |
|---|---:|
| MX | 37 |
| CL | 38 |
| CO | 35 |
| PE | 34 |
| **Total** | **144** |

The 144-case registry is the business denominator. It must not be replaced by the number of Playwright specs, by historical DST counts, or by the number of currently automated MX cases.

## 2. Validation source of truth

PreQA2 is the authoritative validation environment for the official SMB campaign.

An official TC is PASS when its official Expected Result is proven in PreQA2 with runtime evidence. S1/S2/S3 remain useful for implementation, diagnostics, comparison, destructive staging flows and legacy suites, but they do not override a valid PreQA2 official result.

The canonical campaign ledger is `test-mapping/preqa2-validation.json` after live evidence is safely integrated.

Official validation state and automation implementation coverage are deliberately separate dimensions:

- `PASS`, `FAIL`, `BLOCKED`, `NOT_APPLICABLE` and `NOT_RUN` describe official runtime validation.
- `Full`, `Partial` and `Missing` describe persisted automation coverage.
- Official PASS does not automatically promote automation coverage to Full.

## 3. Country model

### Mexico

MX currently has the deepest case-level automation metadata through `test-mapping/mx-qst-coverage.json` and the active PreQA2 live campaign. It is the only market where Full/Partial/Missing automation coverage is currently treated as a complete 37-case denominator.

### Peru

PE is part of the same 144-case official campaign. Existing implementation and reuse analysis are represented by `test-mapping/pe-qst-reuse-plan.json` and the country-scoped Playwright implementation. Reuse classification is not the same thing as official PreQA2 PASS or Full automation.

### Chile and Colombia

CL and CO are not "future countries" in the business model. They are official markets in the 144-case Zephyr scope today.

However, the repository intentionally does not invent detailed selectors, data, store classification or test titles where the official TC metadata has not yet been verified. Shared-family candidates may exist, but case-level automation coverage is not claimed until the official TC is read and runtime evidence is produced.

Therefore:

- CL/CO are present in the official registry, campaign planning, ledger model, closure gates and executive reporting.
- CL/CO may have `Unknown` feature/store metadata for cases that are not yet classified.
- Absence of `tests/<env>/cl/...` or `tests/<env>/co/...` directories does not mean the markets are absent from the architecture; it means country-specific executable implementation has not yet been safely materialized for those cases.

## 4. Architecture layers

```text
Official business scope
  test-mapping/smb-qst.json              144 official TCs (MX/CL/CO/PE)

Case metadata / implementation mapping
  test-mapping/mx-qst-coverage.json      MX 37-case automation coverage
  test-mapping/pe-qst-reuse-plan.json    PE implementation/reuse plan
  shared-family metadata                 CL/CO/PE/MX reuse candidates where verified

PreQA2 campaign control plane
  utils/preqa2ExecutionRequirements.js   registered / guest / EPP requirements
  utils/preqa2CampaignPlan.js             market queue and prioritization
  utils/preqa2RuntimeGuard.js             exact PreQA2 host/market guard
  utils/preqa2Validation*.js              canonical ledger validation
  utils/preqa2ClosureGate.js              campaign closure conditions
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

## 5. Filesystem convention

Executable tests converge on:

```text
tests/<environment>/<country>/<suite>/<area>/
```

Examples already represented in the repository include MX under S1 and PE under S2. New CL/CO executable directories should only be created when a verified official case has enough real configuration and runtime evidence to justify implementation.

The architecture is therefore wider than the current test-directory tree: the registry and campaign model cover all four markets, while executable code grows market by market.

## 6. Authentication model

WMC authentication and Samsung Account authentication are separate concerns.

PreQA2 bootstrap establishes WMC/PreQA2 access. Registered official TCs additionally require a valid Samsung Account session. The campaign must reuse authenticated state when valid and stop only for actual human-only authentication such as MFA/CAPTCHA/phone approval.

Registered/guest/EPP requirements are encoded per official TC where known. A registered official PASS must not be recorded from a guest-only runtime context.

## 7. Safety boundaries

Production is read-only. PreQA2 validation must never escape into Production to continue a scenario.

Payment/order submission, profile writes, CronJobs and other destructive actions remain separately guarded and require explicit authorization. A safe official PreQA2 validation may stop before a destructive submit while still proving a non-destructive Expected Result when the official TC allows it.

## 8. Reporting model

The executive report must always keep these denominators separate:

- Official SMB scope: 144 TCs.
- Market official scope: MX 37, CL 38, CO 35, PE 34.
- MX persisted automation coverage: denominator 37.
- Runtime official execution: derived only from the supplied canonical PreQA2 ledger.

The Executive V3 report additionally exposes market/feature views, attention queues, automation gaps, TC drilldown, recent validation, trend snapshots and consistency auditing. It must not fabricate feature/store execution data when no verified metadata exists.

## 9. Integration rule while live campaign is running

Live browser/CDP campaign changes and remote architecture/reporting work may exist on separate branches. Do not resolve the canonical ledger with a blanket `ours` or `theirs` merge. Preserve live runtime evidence first, reconcile the ledger case by case or with the ledger merge utilities, then run the full PreQA2 gates and reporting tests locally before declaring the integration official.
