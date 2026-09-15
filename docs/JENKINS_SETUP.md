# Samsung SMB Automation - Jenkins Setup

## Current CI scope

The repository `Jenkinsfile` is ready for the official MX S1 Base Store P1/QST campaign. It validates the official 30-TC inventory before execution, uses one Playwright worker and zero retries in the campaign runner, supports Windows and Unix agents, can run headless, injects runtime secrets from Jenkins Credentials, and archives runtime evidence.

## Jenkins agent prerequisites

- Git access to this repository.
- Node.js 24.x (project baseline) and npm.
- Google Chrome available to the agent (`playwright.config.js` uses `channel: chrome`).
- Network/VPN access from the agent to Samsung S1 MX and other endpoints used by the selected tests (including BackOffice/Mailinator/payment provider when applicable).
- Workspace write permission.

A Linux agent is preferred if Samsung provides one, but the Jenkinsfile supports Windows agents as well.

## Required Jenkins credentials

Create exactly these three Jenkins credentials as **Secret file** credentials. The IDs are part of the pipeline contract:

| Credential ID | Source file | Purpose |
| --- | --- | --- |
| `samsung-mx-s1-auth-state` | `playwright/.auth/mx-s1-user.json` | Playwright/Samsung authenticated storage state |
| `samsung-mx-s1-session-storage` | `playwright/.auth/mx-s1-session-storage.json` | MX S1 sessionStorage exported with the auth state |
| `samsung-mx-test-card` | `playwright/.auth/mx-test-card.json` | Approved MX payment test data |

Generate/refresh the first two files locally through the existing approved authentication flow. Do not edit cookies manually and do not bypass MFA/CAPTCHA. Upload the resulting files to Jenkins Credentials.

The pipeline copies all three secret files into the gitignored `playwright/.auth/` directory only for the build and deletes that directory in `post { always { ... } }` before artifacts are archived.

If a Samsung Account session expires, refresh the approved local state and replace the two auth secret files in Jenkins. Credentials are not printed or committed.

## Create the Jenkins job

Recommended: create a **Pipeline** or **Multibranch Pipeline** from SCM.

Repository: `rodrigueslucas-lcs/samsung-order-automation`

Script path: `Jenkinsfile`

For the current development cycle, point the job at `agent/mx-qst-p1-finish`. After the work is merged, point it at the team's permanent integration/default branch.

The Jenkins Git credential used for checkout is separate from the three runtime Secret files above.

## Pipeline parameters

- `RUN_MX_QST=true`: run the official MX QST campaign.
- `RUN_DESTRUCTIVE=true`: required for the complete official 30-TC campaign because it includes authorized payment/order scenarios.
- `HEADLESS=true`: recommended for Jenkins service agents.
- `ENABLE_VIDEO=false`: keep disabled until FFmpeg/video is proven on the real agent.

For a first infrastructure-only build, set `RUN_MX_QST=false`. Checkout, Node/npm/Git/Chrome diagnostics, `npm ci`, the official SMB gate and the exact MX 30/30 list still execute without creating an order.

For the first real QST build, enable both `RUN_MX_QST=true` and `RUN_DESTRUCTIVE=true` only on the authorized S1 agent after the three Secret file credentials exist.

## Authentication behavior in CI

Local execution remains unchanged: `npm run qst:mx:base-store` performs the existing manual authentication/bootstrap flow unless explicitly told otherwise.

Jenkins sets `MX_QST_USE_EXISTING_AUTH=1`. In that mode the runner requires the pre-provisioned auth state and session storage instead of opening the interactive login bootstrap. Missing auth material fails closed before the campaign starts.

Jenkins also sets `MX_QST_HEADLESS=1` when `HEADLESS=true`. This removes `--headed` from the Playwright invocation but does not weaken any functional assertion.

## Artifacts

Jenkins sets `MX_QST_ARTIFACT_DIR=test-results/jenkins/mx-qst` and archives `test-results/**/*` plus `playwright-report/**/*` after the secret directory has been removed.

Current Playwright evidence behavior:

- screenshots: on;
- trace: retain on failure;
- video: opt-in with `ENABLE_VIDEO=true` / `PW_VIDEO=1`.

Video remains opt-in because a managed Windows environment previously produced FFmpeg `spawn EPERM` during teardown. Enable it only after a small Jenkins-agent proof run.

## First-run checklist

1. Confirm the Jenkins agent can reach Samsung S1 while on the required corporate network/VPN.
2. Confirm Node 24.x, npm, Git and Chrome in `Agent Diagnostics`.
3. Add the three Secret file credentials using the exact IDs above.
4. Run once with `RUN_MX_QST=false` and confirm both official gates pass.
5. Run the authorized QST with `RUN_MX_QST=true`, `RUN_DESTRUCTIVE=true`, `HEADLESS=true`, `ENABLE_VIDEO=false`.
6. Confirm the console reports `Official MX Base P1 selection: 30/30 tests.`
7. Review archived JSON, screenshots and failure traces.
8. Do not blindly rerun a failed destructive TC after a possible payment/order submit; inspect the order/evidence first.

## Security and safety rules

- Never commit passwords, storage-state cookies, session storage, payment test data, or Jenkins secret files.
- Never archive `playwright/.auth/`.
- Payment/order campaign: one worker, zero retries.
- `RUN_DESTRUCTIVE` authorizes the official QST payment/order family only; it does not authorize profile writes or cronjobs.
- MFA/CAPTCHA is never bypassed.
- If a runtime result has no Playwright result status, the runner reports `NOT_RUN`; it must never infer PASS from missing execution evidence.

## Next CI layer after first Jenkins proof

After one real Jenkins build proves agent/network/auth compatibility:

1. Validate screenshot/trace/video artifact UX on Jenkins.
2. Generate the Samsung Executive/Control Center report from the same build runtime JSON/artifacts.
3. Add Allure as technical drill-down while retaining the executive report for management/release reporting.
4. Parameterize market (MX/PE/CO/CL), QST/DST and Base Store/EPP only as those official runners become execution-ready.
5. Add schedules only after authentication/session refresh behavior is operationally reliable.
