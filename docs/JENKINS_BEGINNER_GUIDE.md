# Jenkins Beginner Guide for QA Operators

This guide is for a QA who has never used Jenkins before but needs to operate the already-configured Samsung SMB automation job.

It is intentionally different from `JENKINS_SETUP.md`:

- this file teaches **how to use the existing job**;
- `JENKINS_SETUP.md` explains **how the CI integration is configured and maintained**.

A new QA does not need to become a Jenkins administrator before running the automation.

## Jenkins in one sentence

Jenkins is the shared machine/orchestrator that runs the same repository commands in a controlled environment and publishes common evidence for the team.

Mental model:

```text
local machine                         Jenkins
-------------                         -------
QA chooses command                    QA chooses parameters
QA runs npm command         ->        Jenkins runs pipeline
terminal/browser                       stages/logs
local reports                          shared published reports
local auth state                       protected Jenkins credential
```

Jenkins does not replace understanding the test suite. It automates the repeatable execution around it.

## What a beginner does NOT need to learn first

A QA operator does not need to know, on day one:

- how to install Jenkins;
- how to create agents;
- how plugins are installed;
- Groovy/Jenkinsfile internals;
- how Jenkins credentials are encrypted/stored internally;
- server administration.

Those are maintainer/admin responsibilities.

The operator needs to know the job, parameters, stages, logs and reports.

## Recommended learning sequence

Before Jenkins, complete one local flow:

```text
clone
 -> install
 -> authenticate one market
 -> list scope
 -> run one TC
 -> inspect evidence
```

Then move to Jenkins.

This prevents a common onboarding problem where a new QA sees a red Jenkins build but cannot tell whether the problem is Git, dependency installation, authentication, environment or the TC itself.

## First Jenkins tour

Ask an experienced operator to show these screens once:

1. the configured Samsung automation job;
2. **Build with Parameters**;
3. the build number/history;
4. **Console Output**;
5. the stage/pipeline view;
6. the Executive Dashboard link;
7. Allure;
8. Playwright report/evidence when published.

The goal is not memorization. The QA should understand where to look when something fails.

## Parameters: how to think about them

The current pipeline exposes execution choices such as:

```text
MARKET
ENVIRONMENT
TEST_SUITE
EXECUTION_MODE
BROWSER_MODE
EVIDENCE_MODE
P1_TARGET_IDS
```

Before starting a build, the operator should be able to answer:

```text
Which country am I testing?
Which environment?
Which suite?
Full campaign or target TC(s)?
Is this execution allowed to create/change data?
What evidence do I need?
```

Do not guess parameter combinations. Use the project's documented examples and the current Jenkins job defaults.

## What happens after Build

A simplified pipeline is:

```text
Build Context
    ↓
Checkout
    ↓
Validate Request
    ↓
Agent Health / Dependencies
    ↓
Official Coverage Gate
    ↓
Authentication install + preflight when required
    ↓
Selected QST execution
    ↓
Finalize reports
    ↓
Quality summary
    ↓
Publish evidence
```

This order is important because a red build does not automatically mean a TC failed.

Examples:

- failure in **Checkout** -> repository/SCM problem;
- failure in **Dependencies** -> agent/npm/browser problem;
- failure in **Coverage Gate** -> scope/governance problem;
- failure in **auth verify/preflight** -> session/auth problem;
- failure after tests start -> inspect the affected TC/evidence.

## How to read a failed build

Use this sequence instead of scrolling randomly:

```text
1. Did the pipeline reach the test execution stage?
2. If not, which infrastructure/preflight stage failed?
3. If tests started, how many were selected/executed?
4. Which IDs are PASS / FAIL / BLOCKED / NOT_RUN?
5. Open Executive Dashboard for business summary.
6. Open Allure/trace for technical evidence.
```

A build that fails before Playwright starts has **zero functional TC result**, even though Jenkins marks the build red.

## Local vs Jenkins authentication

CAPTCHA/MFA should be completed locally by a human when Samsung requires it.

The normal handoff is:

```text
local auth refresh
      ↓
verified local session
      ↓
session bundle
      ↓
protected Jenkins credential
      ↓
Jenkins installs session
      ↓
Jenkins verifies it
      ↓
CI campaign
```

A Jenkins service agent should not attempt interactive CAPTCHA/MFA renewal.

## Does every QA need Jenkins access?

No.

A QA who is developing or debugging automation can work locally using the repository commands and local reports.

Jenkins access is needed when the person must:

- execute the shared CI/release campaign;
- validate the exact CI environment;
- publish common reports for the team;
- inspect Jenkins-only failures;
- operate protected CI credentials when authorized.

Therefore the minimum handoff contract is:

```text
Every automation QA can run locally.
CI operators can additionally run Jenkins.
```

## Safe first exercise

After the QA succeeds locally, do a supervised Jenkins exercise:

1. open **Build with Parameters**;
2. choose one agreed market/environment;
3. use an approved targeted/safe execution rather than blindly launching the largest campaign;
4. start the build;
5. watch the stages;
6. locate Console Output;
7. identify selected TC count/IDs;
8. open the published report;
9. explain whether the result was infrastructure, auth, environment or functional.

After they can explain that flow, they are ready to operate the configured job without needing to understand Jenkins administration.

## What is specific to our Jenkins installation

The repository can document what the pipeline expects, but some facts live only on the Jenkins server, such as:

- installed plugins and versions;
- agent/node configuration;
- job URL/name/folder;
- server-level permissions;
- credential IDs and who may update them;
- global tools and Jenkins configuration.

Those server-side facts should be captured by the Jenkins owner/admin in an internal runbook or screenshots where appropriate. Do not put secret values in Git.

The repository's `Jenkinsfile` remains the source for pipeline behavior; the Jenkins server remains the source for server administration/configuration.

## Beginner exit criteria

A new Jenkins operator is ready when they can, without developer help:

```text
open the correct job
choose the correct market/environment
explain target vs full execution
start an approved build
find the first failed stage
confirm whether tests actually executed
find Executive Dashboard / Allure / trace
avoid rerunning ambiguous payment/order submissions blindly
```

They do not need admin privileges to satisfy this checklist.
