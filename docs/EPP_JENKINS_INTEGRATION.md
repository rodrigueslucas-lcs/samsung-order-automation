# EPP S2 Jenkins integration

## Scope and baseline

Four manual jobs (`Samsung-SMB-EPP-MX`, `Samsung-SMB-EPP-PE`,
`Samsung-SMB-EPP-CL`, `Samsung-SMB-EPP-CO`) will consume a shared, isolated
pipeline and the existing official EPP runner. Inventories are MX 7, PE 6,
CL 7 and CO 6. Base Store jobs, Jenkinsfile, workspaces, authentication
schedulers and Auth Operations remain unchanged.

The baseline is commit `42bf971`. Jenkins audit found four executors,
HTML Publisher and Allure plugins, and no existing EPP jobs. Reading the
API succeeded; job creation permission still requires validation.

## Implementation milestones

1. Implement and test a run-scoped quality model. Preserve raw results;
   classify only causally matched defects. Missing official rows are NOT_RUN.
2. Establish durable, programme-scoped payment-attempt authority shared with
   existing attempts before enabling CI financial submission. Ephemeral
   workspace credentials must not become the financial ledger authority.
3. Implement one isolated pipeline with preflight, official runner, causal
   order validation, always-run reporting and quality gate. No login in CI;
   use verified EPP file credentials. No retry of financial tests.
4. Run CL pilot; reconcile its existing Khipu initiation before another
   transfer. Verify actual report URLs and retained evidence.
5. Provision and execute PE, CO and MX, then publish eight separate
   market/store quality views without merging test inventories or runs.
6. Run EPP, reporting, auth and Base Store regression checks; inspect secrets,
   commit and push validated milestones.

## Classification and gates

Raw Playwright/Allure results are immutable inputs. Business categories:
PASS, FAIL, KNOWN_DEFECT, TEST_DATA_REQUIRED, AUTH_BLOCKED,
RECONCILIATION_REQUIRED and NOT_RUN.

Gate precedence: infrastructure error; new functional failure; external
dependency or unexecuted official tests; narrowly matched known defects;
all official tests passed. Known defects never increase PASS counts.

CO tooltip data absence is TEST_DATA_REQUIRED, not proof of RT-746043.
CL transfer pending initiation is RECONCILIATION_REQUIRED, not proof of
SAM-25161. Only a causally observed transfer 403 may match that defect.
MX cash pending initiation never blocks the unrelated card flow.

## Evidence and credential boundaries

Reports must be generated even when preflight or tests fail. Every report
must identify market, S2, programme, run ID, commit and Jenkins build.
Historical results remain separate, never merged into a current PASS.

The current EPP Playwright config deliberately disables automatic traces,
screenshots and video to avoid capturing access codes and card fields.
CI must implement a safe business-evidence boundary before enabling such
recording; do not simply turn on global tracing. No secret bundles,
runtime-data files, raw activation links or auth directories are archived.

## Acceptance status

Architecture audit and initial contracts complete:

- run-scoped quality model and responsive renderer reuse the existing
  Executive CSS and causal known-defect matcher;
- optional S2 CI authority points financial records and leases at the
  operator's existing dedicated `.auth/epp` root; local defaults are unchanged;
- 60 focused reporting/session/financial tests passed, including cross-build
  pending-attempt preservation and independent card/transfer markers;
- Chrome desktop (1440px) and mobile (390px) render checks passed with all
  seven CL rows and no document overflow; these used demonstration NOT_RUN
  data and prove presentation only;
- architecture validation passed.

The broader existing reporting suite exposed stale presentation expectations
in `allureBusinessStructure.test.cjs` (decorative prefixes in plain-text
descriptions); no production reporting behavior was changed to satisfy them.
The sequential diagnostic was interrupted after confirming both failures.
Broader regression remains pending, not PASS.

## Shared CI implementation validation (before CL pilot)

The isolated `Jenkinsfile.epp` now uses the official market runner, FIRST S2
bundles, programme-specific fixtures and a durable financial/lease authority
outside the ephemeral Jenkins workspace. It never performs authentication.
`provision-epp-jenkins.cjs MARKET` is read-only unless `--apply` is supplied;
it refuses to modify jobs or credentials without its ownership marker.

Raw evidence is captured outside the browsable workspace. Public reports
contain sanitized JSON, masked screenshots and sanitized traces. Publication
fails closed if that boundary cannot be verified. Early dependency/credential
failures produce a current-build INFRA_ERROR summary rather than old results.

The executive report independently validates current-run confirmed financial
records and displays public order numbers and their causal SAM IDs. Historical
reconciliation cannot satisfy a normal payment PASS. Existing MX Cash and CL
transfer pending markers remain unchanged and do not block card execution.

Allure reuses the existing executor/environment/history tooling through an
EPP-only raw-status-preservation option. History is separated by market,
environment, programme and targeted/full campaign; Base Store defaults remain
unchanged. Installing reporters initially reproduced Playwright version drift
from locked 1.60.0 to 1.65.0. `install-epp-ci-tools.cjs` now pins every direct
dependency to its lockfile version while installing the fixed reporter versions.

Evidence obtained so far:

- 60 focused CI/reporting/privacy tests passed; 41 session/financial/authority
  tests passed after adding the original legacy-owner lock check.
- Full reporting suite: 138 passed, zero failures or skips. Stale decorative
  description expectations and an incomplete causal fixture were corrected;
  Base Store reporting behavior was not changed to satisfy them.
- Jenkins official declarative validator accepted the pipeline (HTTP 200).
- Real Allure generation and sanitized publication passed with synthetic data;
  the raw status stayed unchanged and the gate remained BLOCKED, as expected
  for demonstration data rather than functional execution.
- Real Chrome desktop/mobile rendering passed with seven CL rows and no
  document overflow.

The complete governance rerun with browser execution permission passed:
1,419 tests, zero failures and zero skips. Official scope, business-step and
architecture gates passed. No EPP job/build or new financial submission has
been created yet.
Real CL pilot, remaining market builds and consolidated Quality Summary remain
acceptance requirements; the integration is not runtime-homologated yet.

### CL pilot 1

`Samsung-SMB-EPP-CL #1` executed the official seven scenarios with raw
5 PASS / 0 FAIL / 2 SKIP. Preflight reused a healthy verified session without
login. New card order `CL261109-78849757` causally validated SAM-24864 and
SAM-24866 in the same run. Existing Cash MX and transfer CL records retained
their exact hashes; private workspace auth files were cleaned.

The build failed after execution because Jenkins Script Security rejected
the `JsonSlurperClassic` constructor during report publication. The pipeline
now delegates current-build manifest/gate parsing to Node with the same strict
identity validation. No sandbox approval or security configuration was changed.
Seven focused tests and the official Jenkins declarative validator passed.
The next pilot must validate actual publication; this failure is infrastructure,
not a functional payment failure.
