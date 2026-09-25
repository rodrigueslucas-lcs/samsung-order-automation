# Governance Integrity Tests

`mapping-tests/` validates scope, mapping, reconciliation and PreQA2 governance logic. These are not browser E2E tests.

Examples include:

- official SMB inventory integrity;
- MX QST scope/readiness;
- QST coverage/metadata drift;
- legacy reconciliation;
- payment market profiles;
- PreQA2 planning, ledgers, recording and closure gates.

The long-term target is `governance/tests/` alongside the governance data/helpers it protects.

Do not delete these tests because they are outside `tests/`; they protect the distinction between official scope, coverage, runtime and historical evidence.
