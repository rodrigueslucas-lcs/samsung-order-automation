# Documentation Index

Use this page as the documentation entry point. Current runtime contracts are listed first; historical discovery material that no longer represents the repository has been removed from the active tree and remains available in Git history.

## Current contracts

- [Repository architecture audit](REPOSITORY_AUDIT.md) — active cleanup/refactor contract and migration rules.
- [Current SMB architecture](CURRENT_ARCHITECTURE.md) — current hybrid tree, target market-first architecture and runtime boundaries.
- [Official SMB priority model](OFFICIAL_SMB_PRIORITY_MODEL.md) — source model for P1/P2 and Base Store/EPP.
- [Environment validation policy](ENVIRONMENT_VALIDATION_POLICY.md) — PreQA2/Staging/Production applicability.
- [Jenkins setup](JENKINS_SETUP.md) — CI orchestration, credentials and targeted P1 execution.
- [Executive Report V3](EXECUTIVE_REPORT_V3.md) — Executive Dashboard contract.
- [MX QST coverage and runner](MX_QST_COVERAGE_MATRIX.md) — active MX Base Store automation scope.

The current official Samsung priority model contains **362 DST rows: 144 P1/QST + 218 P2/DST-only** across MX, PE, CL and CO.

The historical MX Base Store source has 30 P1 rows, but `SAM-25006` is excluded from active MX execution because the inherited PSE path is Colombia-specific. The active MX Base Store runner therefore selects **29 TCs** on S1/STG or S2/STG2. The exclusion remains preserved in governance history rather than being silently removed.

`test-mapping/smb-qst.json` is preserved historical Zephyr traceability data. Its 144 IDs happen to equal the current P1 total, but it is not the current priority source of truth.

## Current runtime baseline

Latest stabilized MX S2 official Base Store P1 baseline:

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

Runtime result, implementation coverage, official scope and historical ledger state remain separate dimensions.

## Coverage / compatibility documentation

These documents remain active while PE generations are reconciled:

- [PE QST compatibility guide](PE_QST_COMPATIBILITY_GUIDE.md)
- [PE Base Store coverage](COVERAGE_MATRIX.md)
- [MX DST Base Store coverage](DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [PE EPP coverage](DST_EPP_COVERAGE_MATRIX.md)
- [DST automation structure](DST_AUTOMATION_STRUCTURE.md)
- [QST coverage matrix](QST_COVERAGE_MATRIX.md)
- [EPP external dependencies](EPP_EXTERNAL_DEPENDENCIES.md)

Physical paths under `tests/s2/pe` are compatibility/runtime assets today, not the target architecture. They must not be deleted merely because newer PE QST work also exists under `tests/s1/pe`.

## Removed discovery material

Old BackOffice discovery notes, PreQA2 investigation notes, ST2 handoff/context documents, office handoff notes, the old QST guide and health-audit snapshots were removed from the active tree during the repository audit because they duplicated or contradicted current contracts.

They remain recoverable in Git history. Current behavior must be derived from the contracts above, governance data and actual runtime output.

## Source templates

`docs/smb_priority_templates/` contains Samsung regional priority templates for MX, PE, CL and CO. They are governance inputs, not executable Playwright specs.

## Reporting stack

1. **Executive Dashboard** — current build/release health and presentation view.
2. **Allure** — SAM/Jira-oriented technical drilldown and attachments.
3. **Playwright** — low-level execution and trace investigation.
4. **Jenkins** — orchestration, gates, secrets, execution and publication.

Reporting implementation and reporting tests now live together under `reporters/`.

## Governance stack

Governance data and integrity tests now live together under `test-mapping/`. The old root `mapping-tests/` folder was removed during consolidation.

## Repository cleanup policy

Before moving or deleting a legacy-looking file:

1. check imports and runtime callers;
2. check `package.json` scripts;
3. check Jenkins references;
4. check reporting/governance consumers;
5. preserve current runtime evidence;
6. validate the affected runner after the change.

Run the structural guard after architecture edits:

```bash
npm run repo:architecture:validate
```

See [Repository architecture audit](REPOSITORY_AUDIT.md) for the active migration plan.
