# Samsung SMB Automation - Jenkins Setup

This document describes the infrastructure prerequisites for the repository `Jenkinsfile`.

## Goal

The first CI milestone is the official MX S1 Base Store P1/QST campaign. The repository validates the official 30-TC inventory before execution, runs Playwright with one worker and no retries for the campaign runner, and archives runtime evidence.

## Jenkins agent prerequisites

- Git access to this repository.
- Node.js compatible with the project (Node 24.x is the project baseline).
- npm.
- Google Chrome available to the Jenkins agent because the Playwright project currently uses `channel: chrome`.
- Network/VPN access to the Samsung S1 endpoints used by MX tests.
- Permission to write the Jenkins workspace and `test-results/`.

Do not install Allure yet. First prove the base pipeline and Playwright artifacts on the real Jenkins agent.

## Jenkins job

Create a Pipeline (or Multibranch Pipeline) pointing at this repository and use `Jenkinsfile` from SCM.

Recommended first run parameters:

- `RUN_MX_QST=true`
- `RUN_DESTRUCTIVE=false` for infrastructure validation only.
- Enable `RUN_DESTRUCTIVE=true` only after authentication and local test-card injection are configured on an authorized S1 agent.

The full official MX QST runner includes payment/order scenarios, so the Jenkinsfile deliberately refuses to run the complete 30-TC campaign unless `RUN_DESTRUCTIVE=true`.

## Authentication

Samsung Account authentication must not be committed to Git. The local flow currently writes Playwright auth state under `playwright/.auth/`, which is gitignored.

For unattended Jenkins execution we still need to choose and validate one of these approaches on the real Samsung Jenkins agent:

1. A Jenkins-managed secret file containing a valid pre-generated Playwright storage state, copied into the expected ignored path for the build; or
2. Jenkins-managed username/password material plus a CI-compatible authentication bootstrap, if Samsung Account/MFA policy permits it.

Do not attempt to bypass MFA/CAPTCHA. If the account requires interactive MFA every run, the pipeline must use an approved reusable session mechanism or remain manually bootstrapped.

## MX test card

The MX payment test data must remain outside Git. Local development loads the ignored test-card file under `playwright/.auth/`.

For Jenkins, store the equivalent test-card JSON as a Jenkins **Secret file** and materialize it only inside the workspace for the build. Never echo its contents to the console and never archive `playwright/.auth/`.

## Artifacts

The MX runner writes campaign artifacts under `test-results/jenkins/mx-qst` when invoked by Jenkins. Jenkins archives `test-results/**/*` and `playwright-report/**/*`.

Current Playwright behavior:

- screenshots: enabled;
- trace: retained on failure;
- video: disabled unless `PW_VIDEO=1` because managed Windows environments previously produced FFmpeg `spawn EPERM` failures.

Validate video support on the Jenkins agent before enabling it globally. A Linux agent is preferable if available because Playwright/FFmpeg automation is generally easier to operate there.

## Next milestones

After the first Jenkins build is proven on the Samsung infrastructure:

1. Wire Jenkins Credentials for auth state and MX test-card data.
2. Validate screenshot/trace/video artifacts from the Jenkins agent.
3. Generate and publish the Samsung Executive/Control Center report from the same build data.
4. Add Allure as the technical drill-down report without replacing the executive report.
5. Parameterize QST/DST, market (MX/PE/CO/CL), Base Store/EPP, and safe/destructive execution.
6. Add schedules only after the corresponding authentication strategy is reliable.

## Security rules

- No passwords, card test data, storage-state cookies, or secret files in Git.
- No `playwright/.auth/` directory in Jenkins artifacts.
- Payment/order execution: one worker, zero retries, no blind rerun after a possible submit.
- Cron/profile-write destructive families keep their independent guards; enabling the QST payment campaign does not authorize them.
