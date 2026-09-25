# Scripts

This folder currently contains CLIs from several concerns that accumulated during the project evolution.

## Current categories

### Authentication

`auth-*` scripts create/open/verify market authentication state.

### CI / execution

`run-*` scripts execute controlled Playwright campaigns and `finalize-*` scripts complete Jenkins reporting.

### Reporting

Allure enrichment/deduplication, dashboard preview and reporting smoke scripts support the Executive/Allure stack.

### Governance

`print-*`, `validate-*`, PreQA2 planning/reconciliation and ledger scripts expose scope, mapping and campaign governance.

## Target structure

```text
scripts/
  auth/
  ci/
  reporting/
  governance/
```

The current flat paths remain a compatibility contract because `package.json`, Jenkins and scripts call one another by explicit path. Move them only as an atomic migration with every caller updated in the same change.

A script that looks small or historical is not automatically dead. Governance wrapper scripts can intentionally be thin entry points over utilities.
