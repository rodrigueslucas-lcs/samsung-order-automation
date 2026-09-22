# Documentation Index

## Current architecture and official scope

- [Current SMB architecture](CURRENT_ARCHITECTURE.md)
- [Official SMB priority model](OFFICIAL_SMB_PRIORITY_MODEL.md)
- [Environment validation policy](ENVIRONMENT_VALIDATION_POLICY.md)
- [Executive Report V3](EXECUTIVE_REPORT_V3.md)
- [Jenkins setup](JENKINS_SETUP.md)

The current official Samsung priority model contains **362 DST rows: 144 P1/QST + 218 P2/DST-only** across MX, PE, CL and CO. Base Store and EPP are separate store contexts inside that model.

The preserved `test-mapping/smb-qst.json` 144-ID Zephyr campaign is historical execution/traceability data. Its total happens to equal the current P1 total, but it is not the current P1/P2 source of truth.

## Active MX QST

- [MX QST coverage and runner](MX_QST_COVERAGE_MATRIX.md)
- [QST automation guide](QST_AUTOMATION_GUIDE.md)

MX currently uses the same official **30 Base Store P1 TCs** on S1/STG and S2/STG2. MX has 38 P1 rows overall when its 8 EPP P1 rows are included.

Runtime result, implementation coverage and historical ledger state are intentionally separate dimensions.

## PreQA2 validation

- [PreQA2 validation campaign](PREQA2_VALIDATION_CAMPAIGN.md)
- [PreQA2 parallel integration](PREQA2_PARALLEL_INTEGRATION.md)
- [PreQA2 discovery](PREQA2_DISCOVERY.md)

PreQA2 is authoritative only for flows actually supported there. A scenario that is not applicable in PreQA2 creates a Staging validation obligation; it is not automatically PASS or permanently blocked.

## DST

- [PE Base Store coverage](COVERAGE_MATRIX.md)
- [MX DST Base Store coverage](DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [PE EPP coverage](DST_EPP_COVERAGE_MATRIX.md)
- [Automation structure and migration](DST_AUTOMATION_STRUCTURE.md)
- [Test health audit](TEST_HEALTH_AUDIT.md)
- [Test plan](test-plan.md)

DST uses the complete priority model for the applicable market/store context. P1 participates in QST + DST; P2 participates in DST only.

## EPP

- [Consolidated discovery](EPP_DISCOVERY.md)
- [External dependencies](EPP_EXTERNAL_DEPENDENCIES.md)

EPP is a distinct store context. Base Store evidence does not by itself prove an official EPP TC.

## BackOffice

- [Discovery and evidence](BACKOFFICE_DISCOVERY.md)
- [Authentication investigation](BACKOFFICE_AUTH_INVESTIGATION.md)

BackOffice, order-status and fulfillment validation belongs to the selected non-Production Staging environment.

## Authentication and safety

- [ST2 project context](ST2_PROJECT_CONTEXT.md)
- [Project README](../README.md)
- [Jenkins setup](JENKINS_SETUP.md)

WMC/PreQA2 authentication and Samsung Account authentication remain separate concerns. MX registered execution supports validated persisted state and one controlled auth renewal for recoverable expiry; CI auto-renew is explicitly opt-in.

Production is read-only.

## Reporting and presentation

The final reporting stack is:

1. Executive Dashboard — release/build health and presentation view.
2. Allure — SAM/Jira-oriented technical drill-down and evidence.
3. Playwright report / Trace Viewer — low-level execution investigation.
4. Jenkins Stage View — pipeline orchestration, gates and report production.

Historical regional ledgers and audit tables are grouped under collapsed **Technical Governance** in the Executive Dashboard.

## Office and handoff

- [Office QA handoff](OFFICE_QA_HANDOFF.md)
