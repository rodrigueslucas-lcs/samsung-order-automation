# Legacy test generations

This boundary is explicit technical debt, not a place for new automation.

`pe-s2/` preserves the older PE/ST2 QST generation plus established PE DST coverage while per-TC reconciliation is completed against `tests/markets/pe`.

Rules:

- no deletion based only on age or folder name;
- no new feature work here unless required to maintain an existing legacy consumer;
- migrate consumers first, validate runtime, then delete the superseded implementation;
- keep official scope and runtime results separate from migration status.
