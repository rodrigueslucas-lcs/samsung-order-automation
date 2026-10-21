# Samsung LATAM SMB QA Automation

Production-grade QA automation, governance and reporting platform for **Samsung LATAM SMB eCommerce** on SAP Commerce / Hybris.

The project currently supports **Mexico (MX), Peru (PE), Colombia (CO) and Chile (CL)** and connects Samsung official QST scope to:

- Playwright browser automation;
- reusable market/business flows;
- authenticated Samsung Account sessions;
- Jenkins execution;
- Executive Dashboard;
- Allure reporting;
- screenshots, video and Playwright Trace;
- sanitized request/response evidence;
- Jira/known-defect governance;
- order/payment evidence where the scenario is explicitly authorized to create an order.

The repository is designed so that a QA can move from an official Samsung TC to reproducible automation evidence without changing the source structure for each environment.

---

## Project snapshot

### Supported markets

| Market | Official Base Store P1/QST coverage audited in Allure | Environment model |
| --- | ---: | --- |
| MX | 29 TCs | S1 / S2 runtime configuration |
| PE | 28 TCs | S1 / S2 runtime configuration |
| CO | 29 TCs | S1 / S2 runtime configuration |
| CL | 31 TCs | S1 / S2 runtime configuration |
| **Total** | **117 TCs** | market-first architecture |

These numbers represent the currently audited **Base Store official P1/QST automation surface**, not a claim that every TC is always executable in every environment. Test-data prerequisites, authentication dependencies and mapped product defects remain explicit at runtime.

### Technology stack

- **Node.js**
- **Playwright 1.60+**
- **JavaScript / CommonJS + ESM where required by Playwright specs**
- **Page Objects + reusable business flows**
- **Jenkins**
- **Allure**
- **Custom Executive Dashboard**
- **Jira / Zephyr-oriented official TC governance**

---

## Architecture

The engineer-facing navigation rule is intentionally simple:

```text
market -> suite -> store
```

Environment (`S1` / `S2`) is runtime configuration, not source-tree taxonomy.

```text
tests/
  markets/
    mx/
      qst/base-store/
      dst/base-store/
      dst/backoffice/
    pe/
      qst/base-store/
      qst/epp/
      dst/base-store/
      dst/epp/
      dst/backoffice/
    co/
      qst/base-store/
      qst/epp/
    cl/
      qst/base-store/
      qst/epp/
    shared/

pages/          Page Objects
flows/          reusable business journeys
config/         market + runtime configuration
scripts/        auth, runners, CI helpers and operational CLIs
utils/          runtime/governance helpers
governance/     official scope, known defects and contracts
reporting/      Executive Dashboard, Allure and evidence processing
docs/           detailed handoff, architecture and engineering guides
```

`tests/markets` is authoritative. Legacy environment-oriented roots are not part of the current architecture.

---

## What the automation proves

The suite is not limited to simple UI checks. Depending on the official TC, the automation can validate:

- authenticated and guest storefront journeys;
- PDP / BC / PLP behavior;
- cart mutations and quantity management;
- BOGO / promotions;
- Samsung Rewards surfaces;
- Samsung Care+;
- Trade-in / Trade-up;
- registered and guest checkout;
- shipping and billing addresses;
- delivery modes;
- credit/debit card flows;
- alternative payment methods;
- order confirmation and Order ID capture;
- Track Order;
- My Account / My Orders;
- BackOffice order/product validation;
- mobile/sticky storefront behavior;
- environment/test-data blockers;
- known functional defects already tracked in Jira.

A TC is never considered PASS just because the script finished. The runtime must prove the expected business result.

---

## Reporting model

The project intentionally separates three reporting layers.

### 1. Executive Dashboard

Used for build/release visibility. It answers first:

- what was in scope;
- what executed;
- what passed;
- what failed;
- what was blocked;
- what is a mapped **Known Defect**;
- what requires QA attention.

Known product defects are visually separated from generic blockers and current build failures. Raw runtime truth is preserved.

### 2. Allure

Used for TC-level QA investigation and presentation.

Every audited official Base Store TC has a business-oriented description containing, as applicable:

```text
Official SAM / Jira TC
Objective
Expected Result
Actual Result
Market
Environment
Store
Feature
User Type
SKU / Product URL
Payment Method
Order ID
Runtime Status
Automation Coverage
Known Defect / Jira link
Business Steps
Evidence attachments
```

The Allure report deliberately hides low-level Playwright noise such as repetitive `click`, `fill`, `waitFor`, `blur` and locator steps. Those technical details remain available in **Playwright Trace**.

For order/payment scenarios, the report can expose sanitized product/order context including **SKU, payment mode, outcome and Order ID** when captured by the execution.

### 3. Playwright technical evidence

Used for deep debugging:

- Trace Viewer;
- screenshot;
- video;
- stdout/error context;
- sanitized request/response evidence when instrumented by the scenario.

This keeps the Allure view readable for QA/business review without losing technical diagnostics.

---

## Runtime result semantics

The suite keeps these outcomes separate:

| Status | Meaning |
| --- | --- |
| **PASS** | Expected business behavior was proven. |
| **FAIL** | Unexpected functional or automation failure. |
| **BLOCKED** | A concrete prerequisite prevents meaningful execution. |
| **KNOWN DEFECT** | Runtime evidence is mapped to an active Jira defect for the exact market/environment/TC scope. |
| **NOT_RUN** | TC was not executed. |

### Known Defects are non-gating only when mapped

Known-defect handling is controlled by `governance/known-defects.json`.

A mapped defect can be represented as non-gating in Jenkins/reporting, while unrelated failures in the same TC or campaign still remain **FAIL**.

Examples of categories currently handled by this model include:

- missing Back to Top control;
- Trade-in defects;
- order/payment environment defects;
- Track Order defects;
- storefront/footer defects.

The rule is strict:

> A real failure must never be converted to BLOCKED or KNOWN DEFECT only to keep the campaign green.

---

## Supported QST commands

| Market | Base Store | List / discovery | EPP | Authentication |
| --- | --- | --- | --- | --- |
| MX | `npm run qst:mx:base-store` | `npm run qst:mx:list` | — | `npm run auth:refresh:mx` |
| PE | `npm run qst:pe:base-store` | `npm run qst:pe:list` | owned under `tests/markets/pe/qst/epp` | `npm run auth:refresh:pe` |
| CO | `npm run qst:co:base-store` | `npm run qst:co:list` | `npm run qst:co:epp` | `npm run auth:refresh:co` |
| CL | `npm run qst:cl:base-store` | `npm run qst:cl:base-store:list` | `npm run qst:cl:epp` | `npm run auth:refresh:cl` |

CL also supports its combined official campaign:

```bash
npm run qst:cl
npm run qst:cl:list
```

PE established DST coverage is canonical under `tests/markets/pe/dst`:

```bash
npm run dst:base-store
npm run dst:epp
npm run dst:backoffice
npm run dst:list
```

MX also exposes DST Base Store commands through `dst:mx:*` scripts.

---

## First-time setup

Requirements:

- supported Node.js runtime for the repository;
- npm;
- Git access;
- Chromium installed by Playwright;
- Samsung staging/VPN/network access when required.

Install:

```bash
npm ci
npx playwright install chromium
```

Validate repository/governance structure:

```bash
npm run repo:architecture:validate
npm run qst:official:gate
npm run qst:steps:gate
```

For structural/refactor acceptance:

```bash
npm run repo:refactor:gate
```

Reporting regression suites are also maintained under `reporting/tests/`.

A static/discovery gate does **not** prove live storefront behavior.

---

## Authentication model

Code is shared; identity/session state is private runtime data.

Conceptually:

```text
refresh
  -> legitimate Samsung Account login
  -> CAPTCHA / MFA when requested
  -> export local session
  -> verify
  -> package
  -> optional Jenkins publish
```

Examples:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
CL_QST_ENVIRONMENT=S2 CL_AUTH_MANUAL=1 npm run auth:refresh:cl
```

CAPTCHA/MFA is a legitimate human security boundary and is never bypassed.

Primary and secondary identities remain independent when an official TC validates account/cart isolation.

---

## Jenkins session handoff

A verified local session bundle can be published into the protected Jenkins File Credential for each supported market:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:mx
PE_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:pe
CO_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:co
CL_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:cl
```

Publishing requires local Jenkins API configuration such as:

```text
JENKINS_URL
JENKINS_USER
JENKINS_API_TOKEN
```

Session material must never be printed or committed.

Jenkins is the shared CI/release execution layer; local execution remains available for development, stabilization and targeted QA validation.

---

## Running locally

Typical S2 Base Store campaigns:

```bash
MX_QST_ENVIRONMENT=S2 npm run qst:mx:base-store
PE_QST_ENVIRONMENT=S2 npm run qst:pe:base-store
CO_QST_ENVIRONMENT=S2 npm run qst:co:base-store
CL_QST_ENVIRONMENT=S2 npm run qst:cl:base-store
```

Targeted execution is preferred during stabilization.

Examples:

```bash
MX_QST_ENVIRONMENT=S2 MX_QST_TARGET_IDS=SAM-25010 npm run qst:mx:base-store
CO_QST_ENVIRONMENT=S2 CO_QST_TARGET_IDS=SAM-24901 npm run qst:co:base-store
CL_QST_ENVIRONMENT=S2 CL_QST_TARGET_IDS=SAM-24821 npm run qst:cl:base-store
```

Destructive payment/order flows require the relevant explicit runtime authorization. Do not enable those flags casually.

The recommended operating model is one market campaign at a time unless a separately proven orchestrator is being used.

---

## Evidence and data safety

Evidence is designed to be useful without leaking secrets.

The reporting layer can sanitize or avoid exposing:

- passwords;
- session tokens;
- cookies;
- sensitive card data;
- authentication material;
- private query-string data where not needed.

Order/product metadata such as SKU, public Order ID, payment mode and runtime outcome may be attached when relevant to the official scenario.

---

## Production safety

Production is validation-only unless a separately approved process explicitly authorizes an action.

Never:

- submit Production payments/orders as part of normal automation;
- mutate Production profiles;
- run destructive Production BackOffice/CronJob actions;
- use Production as fallback because staging is unavailable;
- blindly retry an ambiguous payment/order submission;
- commit passwords, cookies, tokens, cards or session material.

State-changing non-Production actions are guarded by explicit runtime controls such as:

```text
ALLOW_PAYMENT_SUBMIT
ALLOW_PROFILE_WRITE
ALLOW_CRONJOB_RUN
```

where applicable.

---

## QA failure classification

When a TC does not pass, diagnose the cause before changing the test:

```text
Authentication / session
Test data / prerequisite
Environment / backend
Known functional defect
New functional defect
Automation defect
```

This classification drives whether the outcome should be FAIL, BLOCKED or mapped Known Defect.

A test that fails before reaching the behavior under validation must not be incorrectly linked to an unrelated product defect.

---

## Presentation flow

For a project/demo presentation, the recommended order is:

```text
1. Project purpose and regional scale
2. Market-first architecture
3. Official TC governance
4. Jenkins execution
5. Executive Dashboard / build health
6. Allure TC drill-down
7. Business steps + Objective / Expected / Actual
8. SKU / request-response / Order ID evidence
9. Known Defect and blocker handling
10. Playwright Trace for deep debugging
11. Scalability to other markets/suites
```

A good demo TC is an end-to-end payment/order scenario because it can show the complete chain:

```text
Official TC
 -> product/SKU
 -> storefront journey
 -> checkout
 -> payment
 -> Order ID
 -> confirmation
 -> evidence
 -> Jenkins / Dashboard / Allure
```

A mapped Known Defect is also useful to demonstrate that the framework distinguishes a known product problem from a new regression without hiding raw runtime truth.

---

## Handoff workflow

A new QA should be able to follow this without editing source code:

```text
clone
 -> npm ci
 -> install Chromium
 -> connect required network/VPN
 -> choose market/environment
 -> refresh authentication
 -> complete human CAPTCHA/MFA if requested
 -> list official scope
 -> run one targeted TC
 -> run intended suite
 -> inspect Executive Dashboard
 -> inspect Allure
 -> use Playwright Trace when deeper diagnosis is needed
```

If this requires undocumented intervention, treat that as a tooling/documentation defect.

---

## Documentation

- [`docs/HANDOFF_GUIDE.md`](docs/HANDOFF_GUIDE.md) — first use and ownership transfer.
- [`docs/AUTHENTICATION_GUIDE.md`](docs/AUTHENTICATION_GUIDE.md) — authentication/session lifecycle.
- [`docs/JENKINS_BEGINNER_GUIDE.md`](docs/JENKINS_BEGINNER_GUIDE.md) — operator-oriented Jenkins guide.
- [`docs/JENKINS_SETUP.md`](docs/JENKINS_SETUP.md) — Jenkins engineering configuration.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — common runtime failures.
- [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md) — canonical architecture contract.
- [`docs/OFFICIAL_SMB_PRIORITY_MODEL.md`](docs/OFFICIAL_SMB_PRIORITY_MODEL.md) — official scope model.
- [`docs/EXECUTIVE_REPORT_V3.md`](docs/EXECUTIVE_REPORT_V3.md) — Executive Dashboard + reporting contract.
- [`docs/README.md`](docs/README.md) — documentation index.

Root `README.md` is the primary operator and project-overview entry point. Detailed documents should have one clear responsibility and must not compete with it for onboarding ownership.
