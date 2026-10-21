# Executive Report V3

`reporting/executive-v3/` is the current executive reporting layer for Samsung SMB QA Automation.

Its purpose is to present current build health first while preserving official scope, automation coverage, evidence, known-defect governance and historical traceability behind controlled drill-downs.

## Reporting principles

The reporting stack keeps these dimensions separate:

1. **Current official scope** — the Samsung P1/QST and related store ownership model.
2. **Current build runtime** — what Playwright actually executed in this build.
3. **Automation coverage** — implementation maturity, independent from PASS/FAIL.
4. **Known defect governance** — active Jira defects mapped by market/environment/store/TC.
5. **Technical evidence** — screenshots, video, Playwright Trace, context and sanitized request/response evidence.
6. **Governance/history** — regional scope, audit checks and preserved historical campaign data.

The current audited Base Store Allure surface is:

| Market | Official Base Store P1/QST TCs |
| --- | ---: |
| MX | 29 |
| PE | 28 |
| CO | 29 |
| CL | 31 |
| **Total** | **117** |

These counts describe the active audited automation/reporting surface. They do not imply that every scenario is executable in every environment without valid authentication, configuration and test data.

## Reporting stack

The project uses three complementary reporting levels.

### Executive Dashboard

The dashboard is executive-first and should answer:

- what was in scope;
- what executed;
- what passed;
- what failed;
- what is blocked;
- what is an active mapped Known Defect;
- what requires QA attention.

Mapped known defects are visually separated from generic blockers and current build failures. The underlying runtime data remains unchanged.

### Allure

Allure is the TC-level investigation and presentation layer.

For audited official Base Store TCs, the report can expose:

- SAM / Jira TC;
- Objective;
- Expected Result;
- Actual Result;
- Market / Environment / Store;
- Feature;
- User Type;
- SKU / Product URL;
- Payment Method;
- Order ID when captured;
- Runtime Status;
- Automation Coverage;
- Known Defect and Jira link when applicable;
- business-oriented steps;
- evidence attachments.

Low-level Playwright API noise (`click`, `fill`, `waitFor`, locator internals, etc.) is hidden from the primary Allure presentation. Full technical browser detail remains available in Playwright Trace.

### Playwright evidence

Deep debugging remains available through:

- Playwright Trace;
- screenshots;
- video;
- stdout / error context;
- sanitized request/response attachments where the scenario records them.

This separation keeps the primary QA report readable without sacrificing diagnostics.

## Result semantics

The report must keep these outcomes distinct:

- **PASS** — expected behavior was proven;
- **FAIL** — unexpected functional or automation failure;
- **BLOCKED** — prerequisite/test-data/environment dependency prevents meaningful execution;
- **KNOWN DEFECT** — runtime item is mapped to an active Jira defect for the exact execution scope;
- **NOT_RUN** — not executed.

Known defects are resolved through `governance/known-defects.json` and are non-gating only when the runtime item matches the mapped market/environment/store/TC scope.

A mapped defect must never hide an unrelated failure.

## Known-defect rendering

The Executive Dashboard can reclassify actionable runtime rows (`FAIL`, `BLOCKED`, `SKIPPED-BLOCKED`) as **Known Defect** when a valid active mapping exists.

The Allure normalization layer also hardens blocked Known Defect results so they remain renderable and non-gating while preserving:

- Jira ID;
- defect title;
- original runtime context;
- evidence;
- business-readable TC metadata.

Dangling attachment references are removed before report generation to avoid broken detail panels.

## Expected Result vs Actual Result

Allure should make the comparison explicit.

Example PASS:

```text
Expected Result:
The registered payment reaches Samsung confirmation and produces a valid Order ID.

Actual Result:
PASS — all automated assertions executed for this scenario were satisfied.
```

Example Known Defect:

```text
Expected Result:
The Back to Top control is rendered and returns the viewport upward.

Actual Result:
BLOCKED / KNOWN DEFECT RT-746043 — the mapped storefront control is missing in the target environment.
```

Example FAIL:

```text
Actual Result:
FAIL — <runtime error / assertion evidence>
```

The report must not invent an Actual Result that was not supported by runtime evidence.

## Final presentation structure

Recommended presentation flow:

1. **Project / regional scope**
2. **Market-first architecture**
3. **Jenkins execution**
4. **Executive Dashboard / Build Health**
5. **Execution at a glance**
6. **Needs Attention** when applicable
7. **Known Defects / blockers**
8. **Allure TC drill-down**
9. **Objective / Expected / Actual / business steps**
10. **SKU / request-response / Order ID evidence**
11. **Playwright Trace** for deep debugging
12. **Scalability / governance**

## Current build evidence

For each current TC, the reporting stack may expose:

- SAM/Jira ID;
- runtime status;
- failure/blocker category;
- duration;
- known-defect mapping;
- screenshot;
- video when enabled;
- Playwright trace;
- error context;
- sanitized request/response evidence;
- product/order/payment metadata when captured.

A clean build does not need a large `Needs Attention` section. FAIL/BLOCKED/Known Defect rows remain explicit when they exist.

## Trace Viewer behavior

`Open Trace` uses the archived Jenkins trace URL with Playwright Trace Viewer.

The Jenkins artifact must be browser-reachable. Authentication, CORS and local-network browser policy can block remote loading even when the trace ZIP itself is valid.

When Jenkins is served from `localhost`, Chromium-based browsers may require Local Network Access permission for `trace.playwright.dev` before the viewer can fetch the local Jenkins artifact.

## Generator

Direct generation is implemented under:

```text
reporting/executive-v3/generateExecutiveV3.cjs
```

Market runners typically generate presentation copies inside their Jenkins artifact directory, for example:

```text
test-results/jenkins/<market-or-suite>/executive/index.html
```

The exact artifact folder is runner-specific and must be derived from the runner configuration rather than assumed globally.

## Non-fabrication rules

The dashboard and Allure must never:

- infer PASS from missing runtime evidence;
- mix current runtime totals with historical ledger totals;
- present automation coverage as execution status;
- fabricate feature/store metadata for unknown cases;
- silently hide an audit inconsistency;
- convert environment/authentication failures into automation PASS;
- convert a generic blocker into a Known Defect without a valid mapping;
- treat a mapped defect as permission to hide unrelated failures;
- claim order creation without Order ID/outcome evidence.

When no real Playwright runtime is supplied, execution-specific metrics remain unavailable rather than being invented.

## Presentation usage

The recommended storytelling is:

```text
Official TC
 -> market/runtime selection
 -> Jenkins
 -> Playwright business journey
 -> Executive build health
 -> Allure TC detail
 -> evidence / Order ID / request-response
 -> Known Defect or PASS/FAIL classification
 -> Trace Viewer when needed
```

The Executive Dashboard answers the release/execution question first. Allure explains the TC in business language. Playwright Trace remains the technical forensic layer.
