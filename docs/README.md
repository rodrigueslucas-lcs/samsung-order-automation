# Documentation Index

Use this page as the documentation entry point. Current runtime contracts are listed first; discovery and historical material is intentionally separated so old investigations are not mistaken for current architecture.

## Current contracts

- [Repository architecture audit](REPOSITORY_AUDIT.md) — KEEP / RELOCATE / LEGACY / DELETE classification and migration rules.
- [Current SMB architecture](CURRENT_ARCHITECTURE.md) — current hybrid tree, target market-first architecture and runtime boundaries.
- [Official SMB priority model](OFFICIAL_SMB_PRIORITY_MODEL.md) — source model for P1/P2 and Base Store/EPP.
- [Environment validation policy](ENVIRONMENT_VALIDATION_POLICY.md) — PreQA2/Staging/Production applicability.
- [Jenkins setup](JENKINS_SETUP.md) — CI orchestration and credentials.
- [Executive Report V3](EXECUTIVE_REPORT_V3.md) — Executive Dashboard contract.
- [MX QST coverage and runner](MX_QST_COVERAGE_MATRIX.md) — active MX Base Store automation scope.
- [QST automation guide](QST_AUTOMATION_GUIDE.md) — QST operator/runtime guidance.

The current official Samsung priority model contains **362 DST rows: 144 P1/QST + 218 P2/DST-only** across MX, PE, CL and CO.

The historical MX Base Store source has 30 P1 rows, but `SAM-25006` is currently excluded from active MX execution because the PSE path in the inherited data is Colombia-specific. The active MX Base Store runner therefore selects **29 TCs** on S1/STG or S2/STG2. The exclusion is preserved for audit rather than deleted from history.

The preserved `test-mapping/smb-qst.json` 144-ID Zephyr campaign is historical traceability data. Its total happens to equal the current P1 total, but it is not the current priority source of truth.

## Current runtime baseline

The latest stabilized MX S2 official Base Store P1 baseline is:

```text
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

Runtime result, implementation coverage, official scope and historical ledger state remain separate dimensions.

## DST / PE compatibility documentation

These documents remain relevant while PE generations are reconciled:

- [PE Base Store coverage](COVERAGE_MATRIX.md)
- [MX DST Base Store coverage](DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [PE EPP coverage](DST_EPP_COVERAGE_MATRIX.md)
- [DST automation structure](DST_AUTOMATION_STRUCTURE.md)

Physical paths under `tests/s2/pe` are compatibility/runtime assets today, not the target architecture. Do not delete them merely because newer PE QST work also exists under `tests/s1/pe`.

## Historical / discovery / investigation material

The documents below are valuable engineering evidence, but they are **not authoritative for current TC counts or physical architecture** unless a current contract above explicitly points to them.

### PreQA2

- [PreQA2 validation campaign](PREQA2_VALIDATION_CAMPAIGN.md)
- [PreQA2 parallel integration](PREQA2_PARALLEL_INTEGRATION.md)
- [PreQA2 discovery](PREQA2_DISCOVERY.md)

### EPP

- [EPP discovery](EPP_DISCOVERY.md)
- [EPP external dependencies](EPP_EXTERNAL_DEPENDENCIES.md)

### BackOffice

- [BackOffice discovery and evidence](BACKOFFICE_DISCOVERY.md)
- [BackOffice authentication investigation](BACKOFFICE_AUTH_INVESTIGATION.md)

### Project evolution / handoff

- [ST2 project context](ST2_PROJECT_CONTEXT.md)
- [Test health audit](TEST_HEALTH_AUDIT.md)
- [Office QA handoff](OFFICE_QA_HANDOFF.md)

These files document how the framework was discovered/stabilized. They should not override `README.md`, `CURRENT_ARCHITECTURE.md`, `REPOSITORY_AUDIT.md`, the official inventory contract or actual runtime output.

## Source templates

`docs/smb_priority_templates/` contains the Samsung regional priority templates used by the governance layer:

- MX
- PE
- CL
- CO

They are business-scope inputs, not executable Playwright specs.

## Reporting stack

1. **Executive Dashboard** — current build/release health and presentation view.
2. **Allure** — SAM/Jira-oriented technical drilldown and attachments.
3. **Playwright** — low-level execution and trace investigation.
4. **Jenkins** — orchestration, gates, secrets, execution and publication.

Historical regional ledgers and audit data belong to governance; they must never overwrite current build results.

## Repository cleanup policy

Before moving or deleting a legacy-looking file:

1. check imports;
2. check `package.json` scripts;
3. check Jenkins references;
4. check reporting/governance consumers;
5. preserve current runtime evidence;
6. validate the affected runner after the change.

See [Repository architecture audit](REPOSITORY_AUDIT.md) for the active migration plan.
