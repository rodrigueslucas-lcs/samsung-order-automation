# Governance

`governance/` is the canonical boundary for official scope, mapping, reuse plans, runtime ledgers and governance integrity tests.

## Authoritative/current contracts

- `official-smb-inventory.json` — current official SMB inventory derived from Samsung regional priority templates;
- `mx-qst-coverage.json` — MX QST implementation mapping;
- `mx-qst-partial-plan.json` — MX gap/partial planning data;
- `pe-qst-reuse-plan.json` — PE reuse/stabilization plan;
- `mx-s1-qst-runtime.json` — reconciled S1 runtime ledger;
- `tests/` — integrity tests for governance/mapping contracts.

## Historical / compatibility data

- `smb-qst.json` — preserved Zephyr campaign traceability, not the current P1 denominator;
- PreQA2 ledgers/work queues — historical campaign/governance evidence unless explicitly reconciled into a current runtime view.

During migration the hidden root `test-mapping/` tree remains byte-identical for callers that have not yet cut over. Do not let the two trees diverge.

Rule: official scope, implementation coverage, current runtime and historical evidence are independently auditable dimensions. Never infer PASS from coverage/history and never overwrite current runtime with historical mapping state.
