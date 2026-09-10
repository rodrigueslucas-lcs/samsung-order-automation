# Samsung LATAM SMB QA Automation

Playwright automation and QA campaign tooling for Samsung LATAM SMB eCommerce on SAP Commerce.

The repository models the official Zephyr SMB scope across **Mexico, Chile, Colombia and Peru** and separates four concepts that must not be mixed:

1. **Official business scope** — 144 Zephyr QST cases.
2. **Environment applicability** — which non-Production environment can legitimately execute the official flow.
3. **Official runtime validation** — PASS/FAIL/BLOCKED/NOT_APPLICABLE/NOT_RUN from runtime evidence in the applicable environment.
4. **Automation implementation coverage** — Full/Partial/Missing or reuse classifications, depending on the market.

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

See [Current Architecture](docs/CURRENT_ARCHITECTURE.md) and [Environment Validation Policy](docs/ENVIRONMENT_VALIDATION_POLICY.md).

## Runtime source of truth: correct environment + official Expected Result

The official Zephyr Expected Result is the acceptance criterion. The correct validation environment depends on the flow.

PreQA2 is authoritative for scenarios that are actually supported there. The live MX campaign proved a split in which Home, supported Samsung Account/My Account, PLP, PDP and GNB can be validated in PreQA2, while Cart and downstream flows redirect into Staging and must be validated there.

Therefore:

- a valid PreQA2 PASS remains valid for a PreQA2-supported official flow;
- a Cart/Checkout/Orders/Payment case that is not supported in PreQA2 is `NOT_APPLICABLE` to the PreQA2 leg, not automatically BLOCKED;
- that N/A classification creates a Staging validation obligation rather than closing the official TC;
- the final official runtime result is established in the applicable non-Production environment;
- Production is never used as an alternative validation target.

The current PreQA2 runtime ledger is:

```text
test-mapping/preqa2-validation.json
```

Core rules:

- Official PASS does **not** automatically mean Full automation.
- Automation is promoted only when implementation exists and is actually proven.
- Registered official cases require a real Samsung Account registered context where encoded.
- Guest and EPP requirements are tracked separately.
- PreQA2 and Staging navigation are environment/market guarded; Production redirects must not be followed.
- `NOT_APPLICABLE in PreQA2` must not be misreported as `officially complete` when Staging still owns the flow.

Useful PreQA2 campaign commands after integration:

```bash
npm run preqa2:gate
npm run preqa2:plan
npm run preqa2:closure
npm run preqa2:reconcile
npm run preqa2:promotions
npm run reporting:preqa2
npm run reporting:preqa2:status
```

## Current MX environment routing

Based on live runtime evidence:

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

This is the current verified MX routing. CL/CO/PE routing must be learned from their official TCs and real environment behavior rather than copied blindly.

## Market implementation reality

### Mexico

MX is currently the deepest market in the official QST automation model. `test-mapping/mx-qst-coverage.json` maps all **37 official MX cases** to Full/Partial/Missing coverage and case metadata.

The live campaign classifies the same 37 IDs by environment applicability and runtime result independently from coverage state.

### Peru

PE contributes **34 official cases** to the same SMB baseline. Existing implementation/reuse analysis is represented in `test-mapping/pe-qst-reuse-plan.json` and the country-scoped Playwright implementation.

A reuse candidate is not automatically an official PASS and is not automatically Full automation. It becomes authoritative only after the corresponding official TC is verified and executed in the correct environment/context.

### Chile and Colombia

CL contributes **38** official cases and CO contributes **35**.

The architecture already includes them in:

- the official registry;
- campaign planning;
- ledger/reporting models;
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

Environment validation
  PreQA2                                     storefront flows where supported
  Staging                                    cart/checkout/orders/payment/backoffice where applicable
  environment handoff                       N/A-in-PreQA -> Staging validation obligation

PreQA2 control plane
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

Country directories are created only when there is enough verified official metadata, configuration and runtime evidence to support a real executable implementation. We do not create empty or fake `cl/` and `co/` folders just to make the tree look symmetric.

So today:

- **Business scope:** MX + CL + CO + PE.
- **Campaign/control plane:** MX + CL + CO + PE.
- **Executable test tree:** currently deepest for MX and PE.
- **CL/CO execution code:** added case by case as official behavior is verified.

## Authentication model

There are two distinct authentication concerns in the PreQA2 campaign:

- **WMC / PreQA2 access** establishes the storefront validation session.
- **Samsung Account authentication** is additionally required for registered-user official TCs such as My Account and registered flows.

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
- leave a non-Production validation environment for Production to complete a test.

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

The repository still contains substantial historical and operational DST/QST implementation under S1/S2/S3. Those assets remain useful and are now also relevant as execution targets for official flows that are not applicable in PreQA2.

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

The reporting model must keep these dimensions separate:

- Official SMB scope: **144**.
- MX official scope: **37**.
- CL official scope: **38**.
- CO official scope: **35**.
- PE official scope: **34**.
- PreQA2 applicability/result.
- Staging-required handoff.
- Final official runtime result in the applicable environment.
- MX Full/Partial/Missing automation coverage: denominator **37**, not 144.

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

Do not resolve `preqa2-validation.json` with a blanket `ours` or `theirs` merge. Preserve runtime evidence and environment-routing decisions first, reconcile the canonical ledger, then run the full gates, reporting tests and `git diff --check` locally before declaring the integration official.

## Documentation

- [Current SMB Architecture](docs/CURRENT_ARCHITECTURE.md)
- [Environment Validation Policy](docs/ENVIRONMENT_VALIDATION_POLICY.md)
- [PreQA2 Validation Campaign](docs/PREQA2_VALIDATION_CAMPAIGN.md)
- [PreQA2 Parallel Integration](docs/PREQA2_PARALLEL_INTEGRATION.md)
- [Executive Report V3](docs/EXECUTIVE_REPORT_V3.md)
- [PE DST Coverage](docs/COVERAGE_MATRIX.md)
- [MX S1 DST Base Store Coverage](docs/DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [MX QST Coverage](docs/MX_QST_COVERAGE_MATRIX.md)
- [PE QST Coverage](docs/QST_COVERAGE_MATRIX.md)
- [Documentation index](docs/README.md)
