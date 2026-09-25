# Test Mapping and Governance Data

This directory stores scope, mapping, reuse and runtime-ledger data. Files here are **not all the same kind of source of truth**.

## Current authoritative contract

- `official-smb-inventory.json` — current official SMB inventory contract derived from Samsung regional priority templates.

## Active market/runtime data

- `mx-qst-coverage.json` — MX QST implementation mapping.
- `mx-qst-partial-plan.json` — MX partial/gap planning data.
- `pe-qst-reuse-plan.json` — PE reuse/stabilization plan.
- `mx-s1-qst-runtime.json` — reconciled S1 runtime ledger.

## Historical / compatibility data

- `smb-qst.json` — preserved 144-ID Zephyr campaign; historical traceability, not the current P1 denominator.
- PreQA2 ledgers/work queues — campaign history/governance, not current-build runtime unless explicitly reconciled.

## Architecture metadata

- `smb-qst-architecture.json`
- `smb-shared-core-families.json`

These support implementation/governance analysis and must remain separate from current execution results.

## Rule

Never overwrite a current runtime result with historical mapping state, and never infer PASS from implementation coverage. Scope, runtime, coverage and history are independently auditable dimensions.

The long-term target is to move this concern under `governance/`, together with `mapping-tests/` and governance-specific utilities/scripts, as one atomic migration.
