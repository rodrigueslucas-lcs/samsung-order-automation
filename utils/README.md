# Utilities

`utils/` is currently a compatibility boundary containing both browser-runtime helpers and governance/domain helpers.

## Runtime-oriented examples

- auth/session state helpers;
- environment/config guards;
- destructive-action guards;
- test-card/runtime credential readers;
- network/evidence helpers.

## Governance-oriented examples

- official SMB inventory/parser helpers;
- QST scope/coverage/mapping/reconciliation helpers;
- PreQA2 campaign/ledger/validation helpers.

## Target rule

Runtime helpers should eventually live near the execution domain that owns them, while official scope/mapping/reconciliation logic should move under `governance/`.

Do not delete or relocate a utility based only on its name. Thin helpers may be called by package scripts, reporters, mapping tests or CI runners even when Playwright specs do not import them directly.

The first cleanup phase documents these responsibilities; physical moves happen only with all imports/callers updated atomically.
