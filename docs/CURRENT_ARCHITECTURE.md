# Current SMB QA Automation Architecture

This document describes the current repository architecture after the Samsung SMB scope, MX S1/S2 execution, Jenkins reporting and executive presentation layers were reconciled.

## 1. Authoritative business scope

The current business source of truth is the Samsung priority-template model under `docs/smb_priority_templates/`, represented by the official inventory contract.

| Market | Base Store | EPP | P1 / QST | P2 / DST only | DST total |
|---|---:|---:|---:|---:|---:|
| MX | 56 | 36 | 38 | 54 | 92 |
| PE | 55 | 37 | 34 | 58 | 92 |
| CL | 53 | 36 | 38 | 51 | 89 |
| CO | 54 | 35 | 34 | 55 | 89 |
| **SMB** | **218** | **144** | **144** | **218** | **362** |

Priority and store are independent dimensions:

- **P1 runs in QST + DST**.
- **P2 runs in DST only**.
- Base Store and EPP remain distinct store contexts.

The preserved `test-mapping/smb-qst.json` file is a historical 144-ID Zephyr campaign. Its total must not be confused with the current 144 P1 total.

## 2. Active MX execution model

MX has **38 P1 rows overall**:

- 30 Base Store P1;
- 8 EPP P1.

The active MX Base Store runner executes the same official **30 P1 TCs** on either:

- S1 / `stg.shop.samsung.com`;
- S2 / `stg2.shop.samsung.com`.

Environment selection changes configuration and endpoints, not the selected Base Store P1 inventory.

## 3. Runtime, coverage and history are separate

The architecture deliberately separates:

- **Runtime result**: PASS / FAIL / BLOCKED / NOT_RUN in a specific build/environment.
- **Automation coverage**: Full / Partial / Missing implementation maturity.
- **Historical campaign state**: preserved Zephyr/PreQA2 evidence and ledgers.
- **Official scope**: current Samsung P1/P2 priority inventory.

No reporting layer may infer PASS from coverage or from the absence of an execution result.

## 4. Environment routing

The real business flow decides the validation environment.

PreQA2 may be used for supported storefront/catalog validation. Cart, Checkout, Orders, Payment and BackOffice flows are validated in the applicable Staging environment when PreQA2 does not host the complete journey.

A PreQA2 `NOT_APPLICABLE` result creates a Staging validation obligation; it is not an automatic PASS.

Production is never used as a fallback target.

See [Environment Validation Policy](ENVIRONMENT_VALIDATION_POLICY.md).

## 5. Executable architecture

```text
Official business scope
  docs/smb_priority_templates/              Samsung priority templates
  test-mapping/official-smb-inventory.json  current official inventory contract

Historical / compatibility sources
  test-mapping/smb-qst.json                 preserved 144-ID Zephyr campaign
  test-mapping/preqa2-validation.json       PreQA2 validation ledger
  test-mapping/*-qst-*                      market coverage/reuse/runtime metadata

Executable Playwright
  tests/<environment>/<market>/<suite>/<area>/
  pages/
  utils/

Authentication / guards
  utils/mxAuthState*
  tests/s1/mx/dst/base-store/mx.auth.fixture.js
  utils/mxStagingGuard*
  scripts/auth-login-mx.cjs

Execution / reconciliation / reporting
  scripts/
  reporters/evidence/
  reporters/executive-v3/
  reporters/preqa2/
  reporter-tests/

CI
  Jenkinsfile
```

## 6. Authentication model

WMC/PreQA2 authentication and Samsung Account authentication are separate concerns.

MX registered-user execution uses environment-specific persisted auth state. Before a registered TC continues, the authenticated fixture proves that the session is still usable.

For recoverable setup failures such as an expired Samsung Account session, unusable auth state or expired setup cookie, the fixture can perform **one controlled renewal** using the approved MX login flow, load the refreshed browser state into the current Playwright context, validate authentication again and then continue.

Policy:

- local auto-renew is enabled unless `MX_AUTH_AUTO_RENEW=0`;
- CI/Jenkins auto-renew is disabled unless `MX_AUTH_AUTO_RENEW=1`;
- MFA/CAPTCHA remains human verification and is never bypassed;
- failed renewal remains a failure/blocker.

Credentials, cookies and storage state are runtime-only and must never be committed.

## 7. Safety boundaries

Production is read-only.

Destructive non-Production actions remain explicitly guarded, including:

- payment/order submit;
- customer/profile writes;
- CronJob execution;
- other state-changing operations.

Payment/order execution must not use blind retries after an ambiguous submit. A backend/environment defect must not be hidden by weakening assertions simply to produce a green build.

## 8. Reporting architecture

The reporting stack has four layers.

### Executive Dashboard

Outcome-first presentation view. Final order:

1. Build Health
2. Execution at a glance
3. Needs Attention only when necessary
4. Test Execution
5. MX Automation Coverage
6. Official SMB Scope
7. Coverage by Feature + Gap Queue
8. Technical Governance, collapsed by default

Technical Governance contains:

- Regional Validation Matrix;
- Data Integrity;
- Historical TC Inventory.

### Allure

Technical TC-level investigation organized around Samsung business hierarchy, SAM/Jira IDs, runtime status, categories, steps and attachments.

### Playwright report / Trace Viewer

Low-level Playwright execution and trace investigation.

### Jenkins

Orchestration, coverage gates, environment selection, test execution, report finalization and publication. Pipeline Stage View exposes the operational sequence for presentation and troubleshooting.

## 9. Evidence model

Runtime evidence can include:

- screenshots;
- traces;
- videos when enabled;
- error context;
- business metadata;
- order/payment identifiers when safely recorded.

Evidence and runtime status are reconciled from the actual execution. Historical mapping data must not overwrite current build evidence.

## 10. Trace access from Jenkins

Trace links may use `trace.playwright.dev` with an archived Jenkins trace URL.

The browser must be able to reach the Jenkins artifact. Jenkins authentication/CORS and browser local-network policy can block that fetch even when the ZIP is valid.

When Jenkins runs on localhost, Chromium-based browsers may require Local Network Access permission for the Trace Viewer origin.

## 11. Integration discipline

Do not resolve runtime-ledger conflicts with blanket `ours` or `theirs` choices. Preserve real execution evidence first, reconcile case state deliberately, then run the official gates/reporting validation before treating the integration as canonical.

The final architecture is designed around one rule: **official scope, current runtime, implementation coverage and historical governance must remain independently auditable.**
