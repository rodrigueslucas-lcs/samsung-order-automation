# Executive Report V3

This implementation is intentionally isolated under `reporters/executive-v3/` while the live PreQA2 browser campaign continues on another working tree.

## Goals

- Keep the 144-case official SMB denominator visible at all times.
- Treat PreQA2 official validation as authoritative for campaign PASS/FAIL/BLOCKED state.
- Keep official validation status separate from persisted automation coverage.
- Make it visually explicit that current Full/Partial/Missing coverage is MX-only (37 TCs), not 144-wide.
- Stay useful when the latest Playwright execution artifact contains zero tests.
- Never fabricate feature/store/execution metrics when no real artifact exists.
- Preserve unknown CL/CO metadata as `Unknown` rather than inventing taxonomy.

## Intelligence layers

V3 now contains the following independent views:

1. Official validation by market for MX, CL, CO and PE.
2. MX automation coverage and coverage-by-feature.
3. Automation Gap Queue for Partial/Missing MX cases only.
4. Runtime Attention Required for official FAIL/BLOCKED evidence only.
5. Market × Feature validation matrix prepared for all four markets.
6. Snapshot-ready validation trend/history.
7. Data Consistency Audit covering registry totals, MX coverage totals, canonical statuses and unknown ledger IDs.
8. Full 144-TC drilldown with client-side search and Market/Status/Feature/Store filters.
9. Recent timestamped official validation evidence.
10. Execution Intelligence placeholder that intentionally stays empty until a real Playwright execution artifact is supplied.

The Market × Feature view is conservative: MX uses verified MX mapping metadata, PE uses the existing PE reuse metadata, and CL/CO remain `Unknown` unless case-level metadata is actually present in runtime evidence or later verified sources.

## Current isolated command

Until this branch is integrated, run the generator directly:

```bash
node reporters/executive-v3/generateExecutiveV3.cjs
```

Output:

`test-results/executive-v3/index.html`

Optional arguments:

```bash
node reporters/executive-v3/generateExecutiveV3.cjs path/to/preqa2-validation.json path/to/output.html path/to/history.json
```

The optional history file must be a JSON array. Each item may be either a canonical ledger snapshot directly or an object shaped like:

```json
{
  "label": "Before MX registered campaign",
  "generatedAt": "2026-09-09T18:00:00.000Z",
  "ledger": { "markets": {} }
}
```

V3 never creates fake historical points. If no prior snapshots exist, only the current ledger state is shown.

## Data consistency audit

The dashboard checks, without mutating source data:

- official registry total equals the market-count sum;
- each market has the expected number of unique official IDs;
- MX coverage contains exactly the MX official case count;
- MX Full + Partial + Missing equals the MX official total;
- every ledger result ID belongs to that market's official registry;
- every executed ledger status is canonical.

Any failed audit changes campaign health to `DATA CHECK` so a visually healthy report cannot hide a denominator/schema inconsistency.

## Integration rule

Do not merge live Codex ledger changes by selecting an entire `ours` or `theirs` version. Preserve runtime evidence first, reconcile the canonical PreQA2 ledger, then integrate V3.

Do not add V3 to `package.json` while the live Codex campaign is still editing package/runtime files. Add the final npm script only after the worktrees are reconciled.
