# Executive Report V3

This implementation is intentionally isolated under `reporters/executive-v3/` while the live PreQA2 browser campaign continues on another working tree.

## Goals

- Keep the 144-case official SMB denominator visible at all times.
- Treat PreQA2 official validation as authoritative for campaign PASS/FAIL/BLOCKED state.
- Keep official validation status separate from persisted automation coverage.
- Make it visually explicit that current Full/Partial/Missing coverage is MX-only (37 TCs), not 144-wide.
- Stay useful when the latest Playwright execution artifact contains zero tests.
- Never fabricate feature/store/execution metrics when no real artifact exists.

## Current isolated command

Until this branch is integrated, run the generator directly:

```bash
node reporters/executive-v3/generateExecutiveV3.cjs
```

Output:

`test-results/executive-v3/index.html`

Optional arguments:

```bash
node reporters/executive-v3/generateExecutiveV3.cjs path/to/preqa2-validation.json path/to/output.html
```

## Integration rule

Do not merge live Codex ledger changes by selecting an entire `ours` or `theirs` version. Preserve runtime evidence first, reconcile the canonical PreQA2 ledger, then integrate V3.

## Planned post-integration enhancements

Once the live campaign ledger is merged safely, V3 can add TC-level attention queues, official recent validation, feature/store matrices, automation-gap cards and execution history without changing the distinction between official validation and automation implementation coverage.
