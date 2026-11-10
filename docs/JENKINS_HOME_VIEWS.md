# Samsung SMB — Jenkins Home

`http://localhost:8080/` opens **01 - Overview**, the persistent primary view. Its executive landing page separates Base Store, EPP and Authentication & Operations; the ordinary job table remains available through native tabs.

## Supported integration

The administrator-approved **Dashboard View** plugin provides the managed view. The installed **Safe HTML** formatter sanitizes the presentation. This changes the controller markup formatter from plain text to sanitized HTML; it does not disable sanitization or change CSP, authorization, credentials or authentication.

No injected JavaScript, iframe, redirect, service modification or Jenkins core replacement is used. Native navigation, queue, executor status, permissions and history remain available. The built-in All view and existing Samsung SMB Quality Summary are reused.

| Navigation | Content |
|---|---|
| Overview | Executive header, verified configuration totals and ten job cards |
| Base Store | MX, PE, CL and CO Base Store jobs |
| EPP | MX, PE, CL and CO EPP jobs |
| Auth & Ops | Original automation pipeline and Auth Operations |
| Quality Summary | Existing eight-lane quality view |
| All Jobs | Built-in All view |

Status icons use Jenkins' native `buildStatus` endpoint. The execution link resolves `lastCompletedBuild`; the page does not freeze a build result or duration from a snapshot. Build SUCCESS is distinct from individual QA PASS and known-defect semantics.

Report links identify their actual published build number. Discovery uses the most recent completed build with report actions among the last twenty builds, avoiding stale project-level HTML Publisher aliases that can return HTTP 500. An aborted build without reports does not mislabel an older report as its own. If none is found, the card links to the job. Reapply the provisioner to refresh report shortcuts after new runs; native job/execution links always expose current history. No periodic build or permanent executor is needed.

## Provisioning

Use the existing ignored publisher configuration or `JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`. Never commit credentials.

```bash
node --test governance/tests/jenkinsHomeViews.test.cjs governance/tests/jenkinsHomeWorkspace.test.cjs
node scripts/provision-jenkins-home-views.cjs
node scripts/provision-jenkins-home-views.cjs --apply
```

The first call is read-only. Apply requires Overall/Administer and an installed, active Dashboard View plugin. Plugin installation is a separate administrator decision; this script never installs plugins or restarts Jenkins.

Apply verifies ten approved jobs and managed view ownership, preserves an existing Dashboard on rerun, configures sanitized markup and saves the native primary-view setting. It rejects an unknown formatter or foreign view. Fingerprints compare security realm, authorization strategy, credentials file, executors, controller mode, job configurations and next-build numbers before/after. No build, payment, refresh, scheduler or credential publication is invoked.

The primary view is saved in controller XML. To roll back the landing selection, an administrator can select built-in All in Manage Jenkins → System → Default view; jobs and reports remain intact. Reverting the formatter to Plain text removes presentation styling from descriptions globally.

## Live validation — 2026-11-10

Validated on Jenkins 2.568.3 with Dashboard View 2.569.v5ddb_c9b_a_7264, installed dynamically without restart:

- Actual Chrome navigation to `/`: HTTP 200, executive heading visible, ten native status icons, no page errors, no redirect.
- Reload retained the primary view; controller XML contained its persisted name. A controller restart was **not** performed.
- Desktop 1500px and mobile 390px screenshots inspected; no horizontal document overflow.
- Clicked Base Store (4), EPP (4), Auth & Ops (2), Quality Summary (8), All (10), verifying membership in the browser.
- Job configuration fingerprints and next-build numbers unchanged; no UI-validation build started.
- Report links audited against published build actions; inaccessible project-level aliases replaced with explicit build links.

Screenshots and audit JSON are local evidence under ignored `.agent/tmp/jenkins-home-*`; they contain no auth bundles or credentials. Live evidence is separate from unit/governance tests.

Browser report navigation also rendered Allure, Quality Dashboard and live Auth Operations. Historical MX Base Store build #10 emits a pre-existing invalid-regex JavaScript error in its Allure report while its overview renders; the Home change does not rewrite immutable historical reports or the separate Allure implementation.
