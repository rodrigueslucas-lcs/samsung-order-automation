# Documentation Index

## Current architecture and PreQA2 campaign

- [Current SMB / PreQA2 architecture](CURRENT_ARCHITECTURE.md)
- [PreQA2 validation campaign](PREQA2_VALIDATION_CAMPAIGN.md)
- [PreQA2 parallel integration](PREQA2_PARALLEL_INTEGRATION.md)
- [Executive Report V3](EXECUTIVE_REPORT_V3.md)

These documents describe the current official SMB model: 144 Zephyr QST cases across MX, CL, CO and PE, with PreQA2 as the authoritative validation source and automation coverage tracked separately from official PASS/FAIL state.

## QST

- [MX QST coverage](MX_QST_COVERAGE_MATRIX.md)
- [PE QST coverage](QST_COVERAGE_MATRIX.md)
- [QST automation guide](QST_AUTOMATION_GUIDE.md)

Historical S1/S2 QST implementation remains useful for implementation and diagnostics, but the official SMB campaign denominator is the 144-case registry in `test-mapping/smb-qst.json`.

## DST

- [PE Base Store coverage](COVERAGE_MATRIX.md)
- [MX S1 DST Base Store coverage](DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [PE EPP coverage](DST_EPP_COVERAGE_MATRIX.md)
- [Automation structure and migration](DST_AUTOMATION_STRUCTURE.md)
- [Test health audit](TEST_HEALTH_AUDIT.md)
- [Test plan](test-plan.md)

DST totals represent their own suite scope and must not be confused with the 144 official SMB QST cases.

## EPP

- [Consolidated discovery](EPP_DISCOVERY.md)
- [External dependencies](EPP_EXTERNAL_DEPENDENCIES.md)

EPP is a distinct store context. Base Store evidence does not by itself prove an official EPP TC.

## BackOffice

- [Discovery and evidence](BACKOFFICE_DISCOVERY.md)
- [Authentication investigation](BACKOFFICE_AUTH_INVESTIGATION.md)

## Authentication and project context

- [ST2 project context](ST2_PROJECT_CONTEXT.md)
- Current authentication and safety rules are summarized in the [project README](../README.md).

WMC/PreQA2 authentication and Samsung Account authentication are separate concerns for the live official campaign.

## Office and handoff

- [Office QA handoff](OFFICE_QA_HANDOFF.md)
