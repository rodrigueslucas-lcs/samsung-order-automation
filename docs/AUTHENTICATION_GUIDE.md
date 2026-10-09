# Authentication and Jenkins Handoff Guide

This document explains the authentication lifecycle in plain language first, then maps it to the actual commands.

## The simple mental model

The project has three different things:

1. **Credentials** — email/password or interactive login used to create a session.
2. **Local session state** — browser cookies/storage that prove the user is already authenticated.
3. **Jenkins session bundle** — a packaged copy of the verified local session that Jenkins can install for CI.

The repository source code should contain none of those private values.

## Where private auth data lives

Local runtime files are stored under ignored directories:

```text
playwright/.auth/
playwright/.session-packages/
playwright/profiles/
```

These paths are ignored by Git and must stay that way.

## What happens during refresh

When an operator runs `auth:refresh:<market>`, the market script performs this lifecycle:

```text
login -> export session -> verify session -> package session
```

In more detail:

1. a dedicated Chrome profile is opened;
2. the storefront/Samsung Account login flow is reached;
3. credentials are entered automatically when configured, or manually when manual mode is enabled;
4. CAPTCHA/MFA remains manual whenever Samsung asks for it;
5. after the storefront recognizes the authenticated user, browser state is exported;
6. the verifier reopens/uses that state and confirms the account is actually authenticated;
7. the packager writes a market/environment session bundle for CI handoff.

A file existing is not enough. Verification is the important step.

## Recommended first-time login: manual mode

For a new QA, manual mode is the easiest and safest explanation because the operator sees exactly which account they are authorizing.

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_MANUAL=1 npm run auth:refresh:mx
PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
CO_QST_ENVIRONMENT=S2 CO_AUTH_MANUAL=1 npm run auth:refresh:co
CL_QST_ENVIRONMENT=S2 CL_AUTH_MANUAL=1 npm run auth:refresh:cl
```

Wait until the terminal reports `READY`. Closing the browser before the flow returns/exports can leave the refresh incomplete.

## Primary account files

The exact filenames are internal implementation details, but operators may see files such as:

```text
mx-s2-user.json
mx-s2-session-storage.json
pe-s2-user.json
pe-s2-session-storage.json
co-s2-user.json
co-s2-session-storage.json
cl-s2-user.json
cl-s2-session-storage.json
```

These represent browser-auth state, not source-code configuration.

## Second account

MX and CO currently require a second independent account for specific scenarios.

MX:

```bash
MX_QST_ENVIRONMENT=S2 MX_AUTH_SLOT=second MX_AUTH_MANUAL=1 npm run auth:refresh:mx
```

CO:

```bash
CO_QST_ENVIRONMENT=S2 CO_AUTH_SLOT=second CO_AUTH_MANUAL=1 npm run auth:refresh:co
```

The second account creates separate second-user/session files and is included by the market packager when available.

PE does not require a second account for the current Base Store P1. CL's auth implementation supports a second slot, but the current Base Store P1 does not depend on it.

## Why CAPTCHA/MFA cannot be fully automated

CAPTCHA/MFA is an identity-security decision made by Samsung Account. Bypassing it would be both unreliable and the wrong security model.

Operationally:

```text
session still valid -> no human action
session expired/rotated but login proceeds normally -> refresh can continue
Samsung requests CAPTCHA/MFA -> human completes verification once
verified session -> tests/Jenkins continue automatically
```

The operator does not need to watch every test. They only need to intervene when identity verification is explicitly requested during session creation/renewal.

## Session lifetime

Do not describe the session as having a guaranteed fixed lifetime such as exactly 30 minutes unless measured/proven for the current environment. The practical rule is:

> Session state is temporary and must be verified before an authenticated campaign.

The preflight/verify layer exists because a saved file may become invalid before its local file timestamp suggests anything is wrong.

## Packaging for Jenkins

A successful refresh generates a bundle under:

```text
playwright/.session-packages/
```

Example names:

```text
mx-s2-session-bundle.json
pe-s2-session-bundle.json
co-s2-session-bundle.json
cl-s2-session-bundle.json
```

The bundle contains the verified browser state Jenkins needs for that market/environment. It is sensitive and must not be committed.

## Publishing to Jenkins

Publishing requires these local environment variables:

```text
JENKINS_URL
JENKINS_USER
JENKINS_API_TOKEN
```

Current market-specific publisher commands:

```bash
MX_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:mx
PE_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:pe
CO_QST_ENVIRONMENT=S2 npm run auth:publish:jenkins:co
```

The publisher updates/creates a protected Jenkins file credential rather than placing session contents in source control.

### CL status

CL refresh, verify, package and install are implemented. A dedicated `auth:publish:jenkins:cl` operator command is not currently exposed in `package.json`. Until that gap is implemented and runtime-proven, do not document CL publisher behavior as equivalent to MX/PE/CO.

## Optional refresh + publish flow

MX, PE and CO refresh scripts understand `JENKINS_AUTH_PUBLISH=1`.

Example:

```bash
JENKINS_AUTH_PUBLISH=1 PE_QST_ENVIRONMENT=S2 PE_AUTH_MANUAL=1 npm run auth:refresh:pe
```

For new operators, prefer two explicit steps at first:

```text
1. refresh and verify
2. publish
```

This makes failures easier to understand.

## What Jenkins does with the bundle

Conceptually:

```text
protected Jenkins credential
        ↓
workspace install
        ↓
auth preflight/verify
        ↓
selected QST campaign
        ↓
reports/evidence
```

Jenkins should fail fast when the session cannot be installed/verified. It should not silently fall back to another market/session and should not launch interactive CAPTCHA/MFA renewal on a service agent.

## How to explain user replacement to stakeholders

Recommended wording:

> The automation is not tied to Lucas's account. Authentication is runtime data, not test code. A new QA runs the market refresh command, signs into Samsung Account with their approved user, and the project saves a verified local browser session. That session is kept outside Git and can be packaged into a protected Jenkins credential for CI.

## Security rules

Never commit or paste into tickets/chats:

- passwords;
- auth-state JSON contents;
- sessionStorage values;
- cookies/tokens;
- Jenkins API tokens;
- payment credentials.

Safe things to share:

- filenames;
- command names;
- market/environment;
- hashes generated for integrity checking;
- sanitized logs that do not expose secret values.
