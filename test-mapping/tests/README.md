# Governance Integrity Tests

`test-mapping/tests/` validates scope, mapping, reconciliation and PreQA2 governance logic. These are not browser E2E tests.

Examples include:

- official SMB inventory integrity;
- MX QST scope/readiness;
- QST coverage/metadata drift;
- legacy reconciliation;
- payment market profiles;
- PreQA2 planning, ledgers, recording and closure gates.

Governance data and the integrity tests that protect it now share one obvious top-level boundary under `test-mapping/`.

Do not delete these tests because they are outside `tests/`; they protect the distinction between official scope, coverage, runtime and historical evidence.
