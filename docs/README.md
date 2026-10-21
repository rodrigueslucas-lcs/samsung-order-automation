# Documentation Index

The repository root [`README.md`](../README.md) is the **single primary onboarding and project-overview entry point**.

Use this `docs/` index only when deeper operational or engineering detail is required. Do not treat multiple documentation files as competing READMEs.

## Start here

For a QA/operator taking over the project:

1. [`../README.md`](../README.md) — project overview, architecture, market commands, reporting model and operating flow.
2. [`HANDOFF_GUIDE.md`](HANDOFF_GUIDE.md) — step-by-step ownership transfer / first execution.
3. [`AUTHENTICATION_GUIDE.md`](AUTHENTICATION_GUIDE.md) — personal users, saved sessions, second accounts and Jenkins bundles.
4. [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — runtime/auth/Jenkins/environment failure diagnosis.

If a new QA cannot complete `clone -> authenticate -> target TC -> execute -> inspect Dashboard/Allure/Trace` using these documents, that is a handoff-readiness gap.

## CI and reporting

- [`JENKINS_BEGINNER_GUIDE.md`](JENKINS_BEGINNER_GUIDE.md) — operator-oriented Jenkins usage.
- [`JENKINS_SETUP.md`](JENKINS_SETUP.md) — Jenkins engineering configuration and pipeline behavior.
- [`EXECUTIVE_REPORT_V3.md`](EXECUTIVE_REPORT_V3.md) — Executive Dashboard, Allure drill-down, Known Defect and evidence contract.
- [`ENVIRONMENT_VALIDATION_POLICY.md`](ENVIRONMENT_VALIDATION_POLICY.md) — PreQA2/Staging/Production applicability and safety.

The reporting model is intentionally layered:

```text
Executive Dashboard -> build/release health
Allure              -> TC-level business-readable evidence
Playwright Trace    -> deep technical diagnostics
```

## Architecture and governance

- [`CURRENT_ARCHITECTURE.md`](CURRENT_ARCHITECTURE.md) — canonical market-first architecture.
- [`OFFICIAL_SMB_PRIORITY_MODEL.md`](OFFICIAL_SMB_PRIORITY_MODEL.md) — official P1/P2 and Base Store/EPP model.
- [`REPOSITORY_AUDIT.md`](REPOSITORY_AUDIT.md) — cleanup/refactor contract.
- [`REFACTOR_ACCEPTANCE.md`](REFACTOR_ACCEPTANCE.md) — acceptance gates before compatibility deletion.

Runtime governance also includes active Jira mappings in `governance/known-defects.json`; a mapped Known Defect must never hide an unrelated failure.

## Coverage/reference documents

These are detailed engineering/reference material. They are not onboarding entry points.

- [`QST_COVERAGE_MATRIX.md`](QST_COVERAGE_MATRIX.md)
- [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md)
- [`MX_QST_COVERAGE_MATRIX.md`](MX_QST_COVERAGE_MATRIX.md)
- [`DST_MX_BASE_STORE_COVERAGE_MATRIX.md`](DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [`DST_EPP_COVERAGE_MATRIX.md`](DST_EPP_COVERAGE_MATRIX.md)
- [`DST_AUTOMATION_STRUCTURE.md`](DST_AUTOMATION_STRUCTURE.md)
- [`EPP_EXTERNAL_DEPENDENCIES.md`](EPP_EXTERNAL_DEPENDENCIES.md)
- [`PE_QST_COMPATIBILITY_GUIDE.md`](PE_QST_COMPATIBILITY_GUIDE.md)

## Documentation policy

### One main README

`README.md` at repository root is the source of truth for normal use, onboarding and project-level presentation context.

### Purpose-specific docs

When a topic is too detailed for the root README, create a descriptive document (`AUTHENTICATION_GUIDE.md`, `TROUBLESHOOTING.md`, etc.) instead of another generic README.

### Folder-level READMEs

A folder may keep a README only when it explains a **local ownership/compatibility contract** that is useful while working in that folder.

A folder README must not duplicate the root onboarding guide or become a second set of runtime commands.

## Maintenance rule

When runtime behavior changes:

1. update code;
2. runtime-prove the change where required;
3. update the root README if the operator/presentation workflow changed;
4. update the relevant detailed guide if implementation/reporting lifecycle changed;
5. update reporting/governance docs when status semantics or Known Defect behavior changes;
6. remove stale instructions rather than leaving contradictory alternatives.

Documentation drift is treated as an operational defect because it directly increases QA handoff risk and weakens auditability/presentation quality.
