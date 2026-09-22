# Executive Report V3

`reporters/executive-v3/` is the current executive reporting layer for Samsung SMB QA Automation.

Its purpose is to present current build health first, while preserving coverage, official scope, auditability and historical traceability behind controlled drill-downs.

## Reporting principles

The dashboard keeps these dimensions separate:

1. **Current official scope** — the Samsung P1/P2 priority model.
2. **Current build runtime** — what Playwright actually executed in this build.
3. **Automation coverage** — implementation maturity, independent from PASS/FAIL.
4. **Technical evidence** — screenshots, trace, video, context and failure/blocker details.
5. **Governance/history** — regional ledger, audit checks and preserved historical campaign data.

The current official SMB model is:

- **362** total DST rows;
- **144** P1 / QST rows;
- **218** P2 / DST-only rows;
- **30** MX Base Store P1 TCs in the current official runner;
- **38** MX P1 rows overall when EPP is included.

The preserved 144-ID Zephyr campaign remains historical evidence. It must not be treated as the current 144 P1/QST denominator just because both totals happen to be 144.

## Final presentation structure

The generated dashboard is intentionally executive-first:

1. **QA Execution Dashboard / Build Health**
2. **Execution at a glance**
3. **Needs Attention** — rendered only when current FAIL/BLOCKED items exist
4. **Test Execution** — TC-level current runtime and browser evidence
5. **MX Automation Coverage** — Full / Partial / Missing implementation maturity
6. **Official SMB Scope** — compact 362 / 144 / 218 / current-runner reference
7. **Coverage Details**
   - MX Coverage by Feature
   - Automation Gap Queue
8. **Technical Governance** — collapsed by default
   - Regional Validation Matrix
   - Data Integrity
   - Historical TC Inventory

The default page intentionally avoids dumping historical tables into the primary presentation flow. Governance information is preserved, but exposed on demand.

## Technical Governance

`Technical Governance` groups supporting information that is useful for auditability but should not dominate the first view.

### Regional Validation Matrix

Shows the preserved historical market × feature execution ledger for MX, CL, CO and PE. It is a reference layer and does not replace the current official scope or current build runtime denominator.

### Data Integrity

The dashboard validates source consistency without mutating source data. Checks include:

- official registry totals;
- expected unique official IDs by market;
- MX coverage denominator consistency;
- Full + Partial + Missing reconciliation;
- ledger IDs belonging to the expected official registry;
- canonical executed statuses.

The executive view shows a compact audit summary first; full check details remain available inside governance.

### Historical TC Inventory

The preserved 144-ID Zephyr campaign remains available for traceability, but is collapsed by default and constrained to a scrollable drill-down so it does not make the executive dashboard visually overwhelming.

## Current build evidence

The current runtime is rendered independently from historical governance.

For each TC, the report can expose:

- SAM/Jira ID;
- runtime status;
- failure/blocker category;
- duration;
- screenshot;
- video when enabled;
- Playwright trace;
- error context.

A clean build does not render a large `Needs Attention` section. FAIL/BLOCKED rows remain explicit and are never hidden behind a healthy aggregate.

## Trace Viewer behavior

`Open Trace` uses the archived Jenkins trace URL with Playwright Trace Viewer.

The Jenkins artifact must be browser-reachable. Authentication, CORS and local-network browser policy can block remote loading even when the trace ZIP itself is valid.

When Jenkins is served from `localhost`, Chromium-based browsers may require **Local Network Access** permission for `trace.playwright.dev` before the viewer can fetch the local Jenkins artifact.

## Generator

Direct generation:

```bash
node reporters/executive-v3/generateExecutiveV3.cjs
```

Default output:

```text
test-results/executive-v3/index.html
```

The Jenkins pipeline generates the presentation copy under:

```text
test-results/jenkins/mx-qst/executive/index.html
```

The generator accepts optional ledger/output/history/execution arguments according to the implementation in `generateExecutiveV3.cjs`.

## Non-fabrication rules

The dashboard must never:

- infer PASS from missing runtime evidence;
- mix current runtime totals with historical ledger totals;
- present automation coverage as execution status;
- fabricate feature/store metadata for unknown cases;
- silently hide an audit inconsistency;
- convert environment/authentication failures into automation PASS.

When no real Playwright runtime is supplied, execution-specific metrics remain unavailable rather than being invented.

## Presentation usage

Recommended presentation flow:

`Executive Dashboard → current build health → TC evidence → Allure drilldown → Jenkins pipeline/stages → regional scalability`

The Executive Dashboard answers the release/execution question first. Allure and Playwright remain the detailed technical investigation layers; Jenkins demonstrates how the reporting and evidence are produced automatically.
