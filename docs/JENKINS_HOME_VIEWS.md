# Samsung SMB — Jenkins Home V2

`http://localhost:8080/` opens persistent **01 - Overview** and **Samsung SMB — QA Automation Center**. Existing views and native navigation remain available.

## Supported integration

The scoped `samsung-smb-home` UI plugin extends the installed Dashboard View plugin. Jelly loads same-origin versioned JavaScript/CSS and licensed local flag SVGs. No core patch, redirect, iframe, global injection, CSP relaxation or authentication change. The provisioner preserves the current markup formatter.

GET-only `/samsung-smb-home/snapshot` projects ten approved jobs under the current user's permissions. It does not impersonate SYSTEM, start builds, refresh sessions, publish credentials or consume a permanent executor. Only operational scalars are exposed, never credentials, parameter values, causes or console text.

| Section | Content |
|---|---|
| Base Store | MX — México, PE — Peru, CL — Chile, CO — Colômbia |
| EPP | Same four markets, independent S2 programme context |
| Authentication & Operations | Existing automation and Auth Operations jobs |
| Navigation | Overview, Base Store, EPP, Auth & Ops, Quality Summary, All Jobs |

Cards show latest completed result/duration, last success/failure, running start/elapsed, console/history and verified reports with actual build numbers. Each report type is discovered independently among twenty recent builds and requires an existing archived file. A newer aborted build cannot relabel an older report.

Jenkins SUCCESS never implies all QA tests passed. Quality Gate requires a same-build public EPP model proving market, S2, programme and gate. Missing proof stays explicitly unavailable; published reports remain accessible.

## Operations

Parameterized Build Now opens native parameter review via GET; the operator reviews and submits the native form. Jenkins 2.568.3 renders this form with HTTP 405 on GET without scheduling a build. Non-parameterized Build Now requires an explicit click, obtains a CSRF crumb and submits a native POST form. Page load/polling never invokes it. Running/queued cards navigate to existing execution/job.

Polling runs every fifteen seconds, one request in flight, bounded timeout, exponential error backoff and visible stale/unavailable status. Hidden pages pause; returning resumes. Incremental updates preserve focus and scroll. Queue and online executors come from Jenkins. No background controller timer.

## Build and provision

Requires JDK 21+ and Maven 3.9+. Runtime dependencies are existing Dashboard View and HTML Publisher. Maven uses the declared Jenkins BOM.

```bash
mvn -f reporting/jenkins-home/plugin/pom.xml -B -ntp spotless:apply verify
node scripts/install-jenkins-home-plugin.cjs
node scripts/install-jenkins-home-plugin.cjs --apply
node scripts/provision-jenkins-home-views.cjs
node scripts/provision-jenkins-home-views.cjs --apply
```

Installer dry-run validates local HPI manifest, approved dependencies, baseline and dynamic loading. Apply uses native Plugin Manager upload, refuses replacement of an existing installation and never restarts Jenkins or updates dependencies. Later upgrades require native Plugin Manager update/restart review. Build output is not versioned.

Use existing ignored publisher configuration; never commit credentials. Apply fingerprints jobs, next-build numbers, credentials file, authorization, realm, formatter, CSP, resource domain and executors. Only owned UI/view fields change. Administration requires Overall/Administer; viewing/building respect native permissions.

Rollback: select built-in All as default, remove the control-center portlet through Edit View, then uninstall the scoped plugin via Plugin Manager. Do not uninstall while its portlet remains configured. Jobs/reports/other views stay intact.

## Validation

```bash
node --test governance/tests/jenkinsHomeViews.test.cjs governance/tests/jenkinsHomeWorkspace.test.cjs governance/tests/jenkinsHomeLive.test.cjs governance/tests/jenkinsHomeBrowser.test.cjs
node scripts/verify-jenkins-home.cjs --headed
```

Browser validation uses isolated Chrome and permits only GET/HEAD. Screenshots cover desktop, smaller desktop, mobile and sections. It checks real polling, review forms, report links, console/history, persistent default view and unchanged protected configuration. It never submits a build. Ignored evidence: `test-results/jenkins-home-v2/`.

Java JenkinsRule tests use temporary controllers: GET-only access, current-user permissions, report provenance and same-build quality proof. Browser fixtures cover running/queue states, CSRF failure/success, duplicate prevention, stale polling and responsiveness. Fixtures are not claimed as live builds.

Validated on Jenkins 2.568.3: plugin 2.0.0 activated dynamically without restart; Dashboard View 2.569.v5ddb_c9b_a_7264 and HTML Publisher 429 unchanged. Actual Chrome screenshots inspected. Controller restart was not performed; persisted view configuration is checked directly. Idle runtime is not presented as observed running execution. Historical report defects are not rewritten by Home.
