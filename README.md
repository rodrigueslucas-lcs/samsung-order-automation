# Samsung LATAM SMB QA Automation

Playwright-based QA automation for Samsung LATAM SMB eCommerce on SAP Commerce/Hybris.

The repository supports **MX, PE, CO and CL** and connects Samsung QST/DST scope to local execution, Jenkins, Executive Dashboard, Allure and Playwright evidence.

The engineer-facing rule is intentionally simple:

```text
market -> suite -> store
```

Environment (`S1` / `S2`) is runtime configuration, not a source-tree taxonomy.

## Repository at a glance

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
flows/          reusable business flows
config/         market/runtime configuration
scripts/        auth, runners, gates and operational CLIs
utils/          shared runtime/governance helpers
governance/     official scope and contracts
reporting/      Executive / Allure / evidence
docs/           detailed engineering and handoff guides
```

`tests/markets` is authoritative. The old environment-named/legacy test roots are not part of the current architecture.

## Supported market commands

| Market | Base Store | List | EPP | Authentication |
| --- | --- | --- | --- | --- |
| MX | `npm run qst:mx:base-store` | `npm run qst:mx:list` | — | `npm run auth:refresh:mx` |
| PE | `npm run qst:pe:base-store` | `npm run qst:pe:list` | current PE QST EPP ownership is under `tests/markets/pe/qst/epp` | `npm run auth:refresh:pe` |
| CO | `npm run qst:co:base-store` | `npm run qst:co:list` | `npm run qst:co:epp` | `npm run auth:refresh:co` |
| CL | `npm run qst:cl:base-store` | `npm run qst:cl:base-store:list` | `npm run qst:cl:epp` | `npm run auth:refresh:cl` |

CL also supports the combined official campaign with `npm run qst:cl` / `npm run qst:cl:list`.

PE established DST coverage is canonical under `tests/markets/pe/dst` and is exposed by:

```bash
npm run dst:base-store
npm run dst:epp
npm run dst:backoffice
npm run dst:list
```

Use list/discovery before a broad campaign after structural changes.

## First-time setup

Requirements:

- Node.js 24.x
- npm
- Git access
- Samsung staging/VPN/network access when required

Install:

```bash
npm ci
npx playwright install chromium
```

Validate the repository:

```bash
npm run repo:architecture:validate
npm run qst:official:gate
npm run qst:steps:gate
```

For structural/refactor acceptance:

```bash
npm run repo:refactor:gate
```

A static/discovery gate does **not** prove live storefront behavior.

## Authentication model

Code is shared; identity/session state is local/private.

Conceptually:

```text
refresh
  -> Samsung Account login
  -> CAPTCHA / MFA when requested
  -> export local session
  -> verify
  -> package
  -> optional Jenkins publish
```

Manual onboarding examples:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
CL_QST_ENVIRONMENT=S2 CL_AUTH_MANUAL=1 npm run auth:refresh:cl
```

CAPTCHA/MFA is a legitimate human security boundary and is never bypassed.

Primary and second identities must remain independent where a TC validates user isolation. Current second-account flows are used by specific MX/CO scenarios.

## Jenkins session handoff

A verified local session bundle can be published into the protected Jenkins File Credential for each market:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:mx
PE_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:pe
CO_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:co
CL_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:cl
```

Publishing requires local Jenkins API configuration (`JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`). Session bundle contents must never be printed or committed.

Jenkins is the shared CI/release execution layer; it is not required for a QA to learn and run the suite locally.

## Running locally

Typical S2 Base Store campaigns:

```bash
MX_QST_ENVIRONMENT=S2 npm run qst:mx:base-store
PE_QST_ENVIRONMENT=S2 npm run qst:pe:base-store
CO_QST_ENVIRONMENT=S2 npm run qst:co:base-store
CL_QST_ENVIRONMENT=S2 npm run qst:cl:base-store
```

Targeted execution is preferred for stabilization before a full campaign. Example:

```bash
MX_QST_ENVIRONMENT=S2 MX_QST_TARGET_IDS=SAM-25010 MX_QST_TRACKING_CREATE_ORDER=1 npm run qst:mx:base-store
```

The recommended operating model is one market campaign at a time unless a separately proven orchestrator exists.

## Result semantics

Keep these statuses distinct:

- **PASS** — expected behavior proven.
- **FAIL** — unexpected functional/automation failure.
- **BLOCKED** — a concrete prerequisite prevents meaningful execution.
- **KNOWN BUG** — current evidence narrowly matches an already known defect signature.
- **NOT_RUN** — not executed.

Do not convert a real failure into BLOCKED/KNOWN BUG merely to make a suite green.

## Safety rules

Production is read-only.

Never:

- submit Production payments/orders;
- mutate Production profiles;
- run destructive Production BackOffice/CronJob actions;
- use Production as fallback when staging is unavailable;
- blindly retry an ambiguous payment/order submission;
- commit passwords, cookies, tokens, cards or session material.

State-changing non-Production actions remain guarded by explicit runtime controls such as `ALLOW_PAYMENT_SUBMIT`, `ALLOW_PROFILE_WRITE` and `ALLOW_CRONJOB_RUN` where applicable.

## Handoff workflow

A new QA should be able to follow this without editing source code:

```text
clone
 -> npm ci
 -> install Chromium
 -> connect required network/VPN
 -> choose market/environment
 -> auth:refresh:<market>
 -> complete human CAPTCHA/MFA if requested
 -> list scope
 -> run one targeted TC
 -> run intended suite
 -> inspect Executive / Allure / Playwright evidence
```

If this needs undocumented intervention, treat that as a tooling/documentation defect.

## Documentation

- [`docs/HANDOFF_GUIDE.md`](docs/HANDOFF_GUIDE.md) — first use and ownership transfer.
- [`docs/AUTHENTICATION_GUIDE.md`](docs/AUTHENTICATION_GUIDE.md) — auth/session lifecycle.
- [`docs/JENKINS_BEGINNER_GUIDE.md`](docs/JENKINS_BEGINNER_GUIDE.md) — operator-oriented Jenkins guide.
- [`docs/JENKINS_SETUP.md`](docs/JENKINS_SETUP.md) — Jenkins engineering configuration.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — common failures.
- [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md) — canonical architecture contract.
- [`docs/OFFICIAL_SMB_PRIORITY_MODEL.md`](docs/OFFICIAL_SMB_PRIORITY_MODEL.md) — scope model.
- [`docs/EXECUTIVE_REPORT_V3.md`](docs/EXECUTIVE_REPORT_V3.md) — reporting contract.
- [`docs/README.md`](docs/README.md) — documentation index.

Root `README.md` is the primary operator entry point. Detailed documents should have one clear responsibility and must not compete with it for onboarding ownership.
