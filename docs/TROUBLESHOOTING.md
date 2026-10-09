# Operator Troubleshooting Guide

Use this guide when the project does not behave as expected. Diagnose the cause before changing test assertions or selectors.

## 1. `auth:refresh` asks for credentials or fails before opening login

### Symptom

Messages such as:

```text
Samsung credentials were not found
```

### Meaning

The script is trying automatic credential mode and no approved local/env credential was found.

### Recommended onboarding fix

Use manual mode and sign in interactively:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
CL_QST_ENVIRONMENT=S2 CL_AUTH_MANUAL=1 npm run auth:refresh:cl
```

Do not put passwords into source files.

## 2. CAPTCHA or MFA appears

This is not an automation defect by itself.

Complete the challenge in the dedicated browser and wait for the flow to return to the storefront. The automation intentionally does not bypass identity verification.

If the command times out before the operator can finish, rerun refresh rather than editing test code.

## 3. Session file exists but tests say auth is expired

A saved session file is not proof that the server still accepts it.

Run the market refresh again:

```bash
<MARKET>_QST_ENVIRONMENT=S2 npm run auth:refresh:<market>
```

Use the market-specific prefix shown in the root README.

## 4. Jenkins fails during auth preflight before any TC

Classify this separately from a functional TC failure.

Check:

1. correct market/environment bundle was published;
2. Jenkins installed the expected credential;
3. the bundle was generated after the latest refresh;
4. network/VPN/staging host was reachable;
5. failure is auth validation vs simple navigation timeout.

Do not report an official TC as failed when execution never reached the tests.

## 5. `npm error Missing script`

First run:

```bash
npm run
```

Then compare with the root README. If a market lacks a command that the other markets expose, treat it as a standardization gap rather than inventing an undocumented one-off command.

## 6. `git pull --rebase` refuses because of local changes

Never discard work blindly.

Start with:

```bash
git status
git diff --stat
```

Commit intentional work or stash temporary work before pulling. If a conflict appears, resolve only after understanding both sides.

Do not use force push as a routine recovery mechanism.

## 7. One TC fails locally/Jenkins but passes in the other environment

Collect evidence before patching:

- exact SAM ID;
- market/environment;
- final URL;
- screenshot/trace;
- server/UI error message;
- whether auth/test data was valid;
- whether the same input passes locally.

A CI-only environment/access issue should not be 'fixed' by weakening assertions until the cause is understood.

## 8. Known product defect breaks a release campaign

If the behavior is already proven and a bug/RT will be tracked:

1. keep the TC represented in official scope;
2. capture the exact known failure signature;
3. link the SAM TC to the bug/RT in reporting metadata when available;
4. quarantine only that narrow known signature if the release-health policy permits it;
5. let unrelated failures continue to fail.

Never convert every error in the TC to PASS just because one known defect exists.

## 9. BackOffice login succeeds but a search/action says access denied

Separate authentication from authorization.

If Administration Cockpit login succeeded but an operation shows an explicit access-rights message, the user/session is authenticated but the requested BackOffice item/action may be restricted.

Capture the explicit message. Do not wait for a downstream locator timeout and call it a selector problem.

## 10. Test creates orders/payments

Confirm the intended environment and authorization flags before execution.

Never blindly rerun after an ambiguous submit. First inspect order/payment evidence to determine whether the backend action already happened.

Production remains read-only.

## 11. Full four-market execution

The current recommended operation is one market campaign at a time.

Reasons include:

- independent market auth state;
- temporary session lifetime;
- second-account dependencies in MX/CO;
- shared state/test-data side effects;
- payment/order scenarios;
- clearer release evidence and failure attribution.

A future orchestrator can run markets sequentially with auth preflight. Do not assume simultaneous four-market execution is the maturity target.

## 12. Where to investigate a failure

Recommended order:

```text
Executive Dashboard -> Allure business step -> screenshot/video -> Playwright trace -> code
```

The dashboard tells you the business/result category. Allure identifies the failing SAM/step. Trace is for the detailed browser timeline.

## 13. Before asking another developer for help

Provide:

```text
market
environment
SAM ID
local or Jenkins
exact command/job parameters
error text
screenshot/trace availability
git status if code was changed
```

This is enough to reproduce/diagnose most issues without guessing.
