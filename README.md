# Samsung LATAM SMB QA Automation

Playwright automation and QA campaign tooling for Samsung LATAM SMB eCommerce on SAP Commerce.

The repository models the official Zephyr SMB scope across **Mexico, Chile, Colombia and Peru** and separates three concepts that must not be mixed:

1. **Official business scope** — 144 Zephyr QST cases.
2. **Official runtime validation** — PASS/FAIL/BLOCKED/NOT_APPLICABLE/NOT_RUN from PreQA2 evidence.
3. **Automation implementation coverage** — Full/Partial/Missing or reuse classifications, depending on the market.

Production is read-only. State-changing automation is restricted to explicitly authorized non-Production targets and guarded at runtime.

## Official SMB scope

The authoritative registry is `test-mapping/smb-qst.json`.

| Market | Official TCs |
|---|---:|
| MX | 37 |
| CL | 38 |
| CO | 35 |
| PE | 34 |
| **Total** | **144** |

CL and CO are **not future markets** in the business architecture. They are already part of the official 144-case Zephyr scope. What remains incomplete for those markets is case-level executable automation/configuration where official metadata and runtime behavior have not yet been verified.

See [Current Architecture](docs/CURRENT_ARCHITECTURE.md) for the detailed model.

## Source of truth: PreQA2

PreQA2 is the authoritative validation environment for the official SMB campaign.

If an official TC is executed in PreQA2 and its official Expected Result is proven with runtime evidence, that is the official result. S1/S2/S3 remain useful for implementation, diagnostics, comparison, legacy DST suites, BackOffice, destructive staging flows and fulfillment work, but they do not override a valid PreQA2 official result.

The canonical runtime ledger is:

```text
test-mapping/preqa2-validation.json
```

Core rules:

- Official PASS does **not** automatically mean Full automation.
- Automation is promoted only when implementation exists and is actually proven.
- Registered official cases require a real Samsung Account registered context where encoded.
- Guest and EPP requirements are tracked separately.
- PreQA2 navigation is host/market guarded; Production redirects must not be followed to continue a staging test.

Useful campaign commands after integration:

```bash
npm run preqa2:gate
npm run preqa2:plan
npm run preqa2:closure
npm run preqa2:reconcile
npm run preqa2:promotions
npm run reporting:preqa2
npm run reporting:preqa2:status
```

## Market implementation reality

### Mexico

MX is currently the deepest market in the official QST automation model. `test-mapping/mx-qst-coverage.json` maps all **37 official MX cases** to Full/Partial/Missing coverage and case metadata.

The active PreQA2 campaign validates those same official IDs and records runtime evidence independently from coverage state.

### Peru

PE contributes **34 official cases** to the same SMB baseline. Existing implementation/reuse analysis is represented in `test-mapping/pe-qst-reuse-plan.json` and the country-scoped Playwright implementation.

A reuse candidate is not automatically an official PASS and is not automatically Full automation. It becomes authoritative only after the corresponding official TC is verified and executed in the correct context.

### Chile and Colombia

CL contributes **38** official cases and CO contributes **35**.

The architecture already includes them in:

- the official registry;
- PreQA2 campaign planning;
- canonical ledger structure;
- closure/status reporting;
- executive reporting;
- shared-family candidate analysis where verified.

The repository intentionally does **not** fabricate detailed titles, selectors, test data, store classification or country-specific specs for unverified CL/CO cases. Those entries may remain `Unknown` until the official TC and runtime behavior are inspected.

This is why the business architecture is broader than the current `tests/` and `config/markets/` directory trees.

## Architecture at a glance

```text
Official business scope
  test-mapping/smb-qst.json                 144 official TCs

Market metadata / automation mapping
  test-mapping/mx-qst-coverage.json         MX 37-case Full/Partial/Missing model
  test-mapping/pe-qst-reuse-plan.json       PE reuse/implementation plan
  shared-family metadata                    verified cross-market candidates

PreQA2 campaign control plane
  utils/preqa2ExecutionRequirements.js
  utils/preqa2CampaignPlan.js
  utils/preqa2RuntimeGuard.js
  utils/preqa2Validation.js
  utils/preqa2ValidationLedger.js
  utils/preqa2ResultRecorder.js
  utils/preqa2LedgerMerge.js
  utils/preqa2ClosureGate.js
  utils/preqa2PromotionPlan.js
  scripts/preqa2-*.cjs

Executable automation
  tests/<environment>/<country>/<suite>/<area>/
  pages/
  utils/

Reporting
  reporters/preqa2/
  reporters/executive-v3/
```

## Why you may not see `cl/` and `co/` folders yet

The current executable tree is strongest in MX and PE. That is expected.

The filesystem convention is:

```text
tests/<environment>/<country>/<suite>/<area>/
```

But country directories are created only when there is enough verified official metadata, configuration and runtime evidence to support a real executable implementation. We do not create empty or fake `cl/` and `co/` folders just to make the tree look symmetric.

So today:

- **Business scope:** MX + CL + CO + PE.
- **Campaign/control plane:** MX + CL + CO + PE.
- **Executable test tree:** currently deepest for MX and PE.
- **CL/CO execution code:** added case by case as official behavior is verified.

## Authentication model

There are two distinct authentication concerns in the PreQA2 campaign:

- **WMC / PreQA2 access** establishes the storefront validation session.
- **Samsung Account authentication** is additionally required for registered-user official TCs such as My Account and registered checkout cases.

A valid existing Samsung Account session should be reused when possible. Manual intervention is appropriate only when an actual human-only authentication step appears, such as MFA, CAPTCHA or phone approval.

Credentials, cookies, tokens, storage state and dedicated browser profiles are runtime-only and must never be committed.

## EPP

EPP is a separate store context, not a synonym for Base Store coverage.

An EPP official TC requires legitimate EPP access/configuration for the corresponding market. Base Store evidence may demonstrate reusable implementation, but it cannot by itself prove an official EPP TC.

Production redirects from an EPP or My Account journey must be blocked and recorded as environment behavior rather than followed.

## Destructive-action safety

Production is strictly read-only.

Never:

- submit a Production payment/order;
- run a Production CronJob or cancellation;
- alter Production customer/profile/address/order data;
- leave PreQA2 for Production to complete a staging validation.

Payment/order submit requires explicit authorization and the runtime guard:

```text
ALLOW_PAYMENT_SUBMIT=1
```

CronJob execution requires:

```text
ALLOW_CRONJOB_RUN=1
```

Profile writes and other state-changing flows remain separately guarded. Destructive execution uses one worker and zero retries; ambiguous payment/order submits must never be blindly retried.

## Legacy DST / S1 / S2 / S3 assets

The repository still contains substantial historical and operational DST/QST implementation under S1/S2/S3. Those assets remain useful and are not invalidated by the newer official PreQA2 architecture.

The important distinction is:

- S1/S2/S3 code and evidence = implementation, diagnostics and operational staging assets.
- PreQA2 official ledger = authoritative SMB QST campaign result.

Do not compare old DST scenario totals directly with the 144 official SMB QST denominator; they represent different scopes.

## Reporting

Operational PreQA2 reporting lives under:

```text
reporters/preqa2/
```

Executive V3 lives under:

```text
reporters/executive-v3/
```

The executive report must always keep these denominators separate:

- Official SMB scope: **144**.
- MX official scope: **37**.
- CL official scope: **38**.
- CO official scope: **35**.
- PE official scope: **34**.
- MX Full/Partial/Missing automation coverage: denominator **37**, not 144.
- Official runtime execution: derived only from the supplied PreQA2 ledger.

## Local setup

```bash
npm ci
npx playwright install
```

Useful targeted commands:

```bash
npx playwright test --list
npm run qst:mx:list
npm run qst:pe:list
```

For the isolated Executive V3 branch:

```bash
node --test reporter-tests/executiveV3.test.cjs
node reporters/executive-v3/generateExecutiveV3.cjs
```

## Integration rule

While a live browser/CDP campaign is running, remote architecture/reporting work may exist on a separate branch.

Do not resolve `preqa2-validation.json` with a blanket `ours` or `theirs` merge. Preserve runtime evidence first, reconcile the canonical ledger, then run the full PreQA2 gates, reporting tests and `git diff --check` locally before declaring the integration official.

## Documentation

- [Current SMB / PreQA2 Architecture](docs/CURRENT_ARCHITECTURE.md)
- [PreQA2 Validation Campaign](docs/PREQA2_VALIDATION_CAMPAIGN.md)
- [PreQA2 Parallel Integration](docs/PREQA2_PARALLEL_INTEGRATION.md)
- [Executive Report V3](docs/EXECUTIVE_REPORT_V3.md)
- [PE DST Coverage](docs/COVERAGE_MATRIX.md)
- [MX S1 DST Base Store Coverage](docs/DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [MX QST Coverage](docs/MX_QST_COVERAGE_MATRIX.md)
- [PE QST Coverage](docs/QST_COVERAGE_MATRIX.md)
- [Documentation index](docs/README.md)
