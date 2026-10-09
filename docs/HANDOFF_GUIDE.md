# QA Handoff Guide

This guide is for a QA who did not build the repository and needs to start using it safely.

## Objective

A new operator should be able to reach a first valid market execution without editing source code or receiving private credentials from another QA.

Target onboarding time: approximately 15–30 minutes once machine/VPN access is already available.

## What the new QA needs

- access to the Git repository;
- Node.js 24.x + npm;
- Samsung staging/VPN/network access;
- their own approved Samsung Account or an approved automation/test account;
- access to Jenkins only if they will operate CI;
- knowledge of which market/environment they are responsible for.

## First use

### 1. Clone and install

```bash
git clone <repository>
cd samsung-order-automation
npm ci
npx playwright install chromium
```

### 2. Validate the project

```bash
npm run repo:architecture:validate
npm run qst:official:gate
npm run qst:steps:gate
```

Static gates passing means the repository shape/mapping is valid. It does not mean live environments are healthy.

### 3. Choose one market

Do not begin onboarding by running all four markets. Pick one market, normally S2, and learn the lifecycle end-to-end.

Example PE:

```bash
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
```

When the browser opens, authenticate with the operator's own approved Samsung Account. Complete CAPTCHA/MFA if requested and wait for the command to finish.

### 4. Confirm scope without executing

```bash
npm run qst:pe:list
```

Equivalent market list commands are documented in the root README.

### 5. Execute one target TC

Example:

```bash
PE_QST_ENVIRONMENT=S2 PE_QST_TARGET_IDS=SAM-25103 npm run qst:pe:base-store
```

Use a known safe/read-only target for onboarding where possible.

### 6. Execute the market campaign

```bash
PE_QST_ENVIRONMENT=S2 npm run qst:pe:base-store
```

Review the Executive Dashboard, Allure and Playwright evidence rather than relying only on terminal output.

## How another person's user replaces the original developer's user

No source-code replacement is required.

The repository contains automation logic. User identity is runtime state.

The new QA runs the market refresh command in manual mode and signs into Samsung Account themselves. The automation then exports that browser session into ignored local runtime files. The next test execution loads those files.

Therefore:

```text
old QA identity ≠ committed code
new QA identity ≠ source-code change
```

If a user change requires editing a TC, hardcoding an email or committing a password, treat that as an implementation defect.

## Local vs Jenkins responsibility

### Local operator

Responsible for:

- authenticating when the session needs renewal;
- completing CAPTCHA/MFA when requested;
- validating targeted changes;
- generating a verified session bundle.

### Jenkins

Responsible for:

- receiving a protected session bundle;
- installing it into the build workspace;
- performing auth preflight;
- running the selected campaign;
- publishing evidence/reports.

Jenkins should not attempt interactive CAPTCHA/MFA renewal in the background.

## Primary and second accounts

MX and CO have scenarios requiring a second independent Samsung Account.

Primary:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
```

Second:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second MX_AUTH_MANUAL=1 npm run auth:refresh:mx
CO_QST_ENVIRONMENT=S2 CO_AUTH_SLOT=second CO_AUTH_MANUAL=1 npm run auth:refresh:co
```

Do not use the same business user for both slots when the TC validates user/cart isolation.

## Before a release campaign

1. pull the expected branch/revision;
2. verify market/environment;
3. refresh auth if necessary;
4. confirm target/full scope;
5. ensure required test data/payment flags are intentional;
6. run one market at a time unless a separately proven orchestration exists;
7. analyze failures by cause;
8. register/link known product defects instead of weakening assertions;
9. confirm reports/evidence are published.

## What should be teachable without code knowledge

An operator should understand these concepts:

- market and environment selection;
- `auth:refresh:<market>`;
- primary vs second account;
- target TC vs full campaign;
- CAPTCHA/MFA as a human security gate;
- PASS vs FAIL vs BLOCKED vs known bug;
- where to inspect Dashboard/Allure/trace.

They should not need to understand cookie schemas, storageState internals, ZK internals or Page Object implementation just to operate the suite.

## Handoff acceptance test

Give the repository to a QA who did not develop it and ask them to perform the following with only this documentation:

```text
clone -> install -> authenticate PE S2 -> list scope -> run one TC -> find evidence
```

If they need undocumented commands or developer intervention, capture the missing step and improve the documentation/tooling before declaring the project handoff-ready.
