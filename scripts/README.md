# Scripts

This folder contains executable CLIs from several concerns that accumulated during the project evolution. The file names remain flat for the current MX runtime-acceptance checkpoint so authentication/Jenkins entry points are not churned at the same time as test discovery.

## Current categories

### Authentication

`auth-*` scripts create/open/verify market authentication state.

### CI / execution

`run-*` scripts execute controlled Playwright campaigns and `finalize-*` scripts complete Jenkins reporting.

### Reporting

Allure enrichment/deduplication, dashboard preview and reporting smoke scripts support the Executive/Allure stack.

### Governance

`print-*`, `validate-*`, PreQA2 planning/reconciliation and ledger scripts expose scope, mapping and campaign governance.

## Architecture controls

```bash
npm run repo:architecture:validate
npm run repo:legacy:audit
npm run repo:legacy:audit:strict
```

- `repo:architecture:validate` checks required/forbidden boundaries and temporary mirror parity.
- `repo:legacy:audit` prints any compatibility-boundary references that remain outside the hidden mirror trees.
- `repo:legacy:audit:strict` exits non-zero when actionable runtime/code references remain.

The active Jenkins/MX/PE runners are guarded against regressing to `tests/s1`, `tests/s2`, `reporters/` or `test-mapping/`.

## Target structure

After the canonical MX runtime acceptance checkpoint, executable scripts can be moved atomically to:

```text
scripts/
  auth/
  ci/
  reporting/
  governance/
```

This must be an executable move, not a cosmetic copy, because scripts use relative `../utils`, sibling script calls and explicit package/Jenkins entry points.

A script that looks small or historical is not automatically dead. Governance wrappers can intentionally be thin CLI entry points over utilities. Deletion requires both reference audit and runtime/contract evidence.
