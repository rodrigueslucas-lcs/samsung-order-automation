# Documentation Index

Use this page as the documentation entry point. Current runtime contracts are listed first; historical discovery material that no longer represents the repository is kept in Git history rather than mixed into active guidance.

## Current contracts

- [Repository architecture audit](REPOSITORY_AUDIT.md) — active cleanup/refactor contract and migration rules.
- [Current SMB architecture](CURRENT_ARCHITECTURE.md) — canonical market-first tree, compatibility layer and remaining cutover work.
- [Official SMB priority model](OFFICIAL_SMB_PRIORITY_MODEL.md) — source model for P1/P2 and Base Store/EPP.
- [Environment validation policy](ENVIRONMENT_VALIDATION_POLICY.md) — PreQA2/Staging/Production applicability.
- [Jenkins setup](JENKINS_SETUP.md) — CI orchestration, credentials and targeted P1 execution.
- [Executive Report V3](EXECUTIVE_REPORT_V3.md) — Executive Dashboard contract.
- [MX QST coverage and runner](MX_QST_COVERAGE_MATRIX.md) — active MX Base Store automation scope.
- [PE canonical market ownership](../tests/markets/pe/README.md) — current PE destination and dual-generation reconciliation rule.

Official Samsung priority model: **362 DST rows = 144 P1/QST + 218 P2/DST-only** across MX, PE, CL and CO.

The historical MX Base Store source has 30 P1 rows. `SAM-25006` is an audited exclusion because the inherited PSE path is Colombia-specific, so the active MX Base Store runner selects **29 TCs**.

## Current runtime baseline

```text
MX S2 official Base Store P1
29 selected
29 executed
28 PASS
1 FAIL  -> SAM-25010 Track Order functional defect
0 BLOCKED
0 NOT_RUN
```

This baseline proves the pre-canonical-path runtime behavior. The current refactor branch still requires a post-cutover official MX acceptance run before temporary compatibility mirrors are physically deleted.

Runtime result, implementation coverage, official scope and historical ledger state remain separate dimensions.

## Test navigation

Canonical engineer-facing structure:

```text
tests/markets/mx
tests/markets/pe
tests/markets/shared
tests/legacy/pe-s2
```

`tests/s1/**` and `tests/s2/**` are temporary hidden compatibility mirrors during migration. They are not sources of truth and must not receive new feature work.

Run after structural changes:

```bash
npm run repo:architecture:validate
npm run repo:legacy:audit
npm run repo:pe:audit
```

The architecture gate also checks canonical/compatibility mirrors for byte-level drift during the acceptance window.

## Coverage / compatibility documentation

- [PE QST compatibility guide](PE_QST_COMPATIBILITY_GUIDE.md)
- [PE Base Store coverage](COVERAGE_MATRIX.md)
- [MX DST Base Store coverage](DST_MX_BASE_STORE_COVERAGE_MATRIX.md)
- [PE EPP coverage](DST_EPP_COVERAGE_MATRIX.md)
- [DST automation structure](DST_AUTOMATION_STRUCTURE.md)
- [QST coverage matrix](QST_COVERAGE_MATRIX.md)
- [EPP external dependencies](EPP_EXTERNAL_DEPENDENCIES.md)

`tests/legacy/pe-s2` explicitly marks the older PE/ST2 generation. It is retained because it still contains established DST and legacy QST migration inputs, not because S2 should be a permanent taxonomy.

## Reporting stack

1. **Executive Dashboard** — current build/release health.
2. **Allure** — SAM/Jira-oriented technical drilldown and attachments.
3. **Playwright** — execution and trace investigation.
4. **Jenkins** — orchestration, gates, secrets and publication.

Canonical reporting implementation and integrity tests live under `reporting/`. The root `reporters/` tree is a temporary hidden compatibility mirror only and must not receive new code.

## Governance stack

Canonical scope/mapping/runtime ledgers and integrity tests live under `governance/`. The root `test-mapping/` tree is a temporary hidden compatibility mirror only; the old `mapping-tests/` root must not return.

`governance/smb-qst.json` is preserved historical Zephyr traceability; it is not the current priority source of truth.

## Repository cleanup policy

Before moving/deleting legacy-looking code:

1. check imports/runtime callers;
2. check package scripts;
3. check Jenkins references;
4. check reporting/governance consumers;
5. preserve current runtime evidence;
6. validate the structural guard;
7. runtime-validate the affected official runner before deleting compatibility sources.

See [Repository architecture audit](REPOSITORY_AUDIT.md) for completed phases and remaining migration work.
