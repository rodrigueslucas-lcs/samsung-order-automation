# Regional parallel authentication refresh

## Goal
Refresh Samsung Account sessions for MX, PE, CO and CL concurrently without weakening the existing per-market safety contract.

## Architecture
The regional command is an orchestrator only. It does not replace or bypass the existing market flows.

Each market still executes, in order:

1. connect/open its dedicated Chrome profile;
2. prepare staging cookie and storefront;
3. authenticate only when required;
4. preserve the visible browser for CAPTCHA/MFA;
5. export auth state;
6. verify the exported session in a fresh context;
7. package the verified session;
8. optionally publish the market-specific bundle when `JENKINS_AUTH_PUBLISH=1`.

`READY` keeps the same meaning as the individual refresh command. No regional READY is emitted for a market that did not complete its own pipeline.

When the regional command finds that the scheduled keep-alive already owns a requested market, it follows that exact live recovery instead of starting a competing login or immediately failing BUSY. SECOND remains visibly queued behind pending FIRST gates. It reports READY only after the requested identity is proven and the same cycle acknowledges the bundle synchronization required by `--publish`. Ownership that cannot be correlated safely, or an unrelated job/profile owner, remains BUSY. Following never removes leases, retries credentials or opens another window; it is bounded to 25 minutes by default (`AUTH_REFRESH_FOLLOW_TIMEOUT_MS`, maximum 30 minutes).

## Parallelism model
Parallelism exists only between markets:

```text
MX: login -> verify -> package -> publish
PE: login -> verify -> package -> publish
CO: login -> verify -> package -> publish
CL: login -> verify -> package -> publish
```

The four rows run concurrently. Stages inside one row remain sequential.

Dedicated profiles remain isolated by environment, market and slot, for example:

- `s2-mx-qa`
- `s2-pe-qa`
- `s2-co-qa`
- `s2-cl-qa`

The existing refresh lock is also scoped by market + environment + slot, so duplicate refreshes for the same identity remain blocked while different markets may run together.

## Commands
All four markets, default S2:

```bash
node scripts/auth-refresh-all.cjs
```

Selected markets only:

```bash
node scripts/auth-refresh-all.cjs mx pe
```

S1:

```bash
ENVIRONMENT=S1 node scripts/auth-refresh-all.cjs
```

Equivalent environment variable selection:

```bash
AUTH_REFRESH_MARKETS="mx,co" AUTH_REFRESH_ENVIRONMENT=S2 node scripts/auth-refresh-all.cjs
```

## Failure isolation
One market must not cancel sibling markets.

Example:

```text
MX  READY
PE  READY
CO  HUMAN
CL  READY
```

`HUMAN` means the Samsung Account flow requires operator CAPTCHA/MFA interaction. It is not converted into an automatic retry and it never produces false READY.

A normal failure is also isolated to that market. The orchestrator exits non-zero when at least one selected market is not READY, but waits for all selected market pipelines to settle first.

## Existing safety invariants preserved
- no blind three-attempt login loop;
- only a classified lost browser/page may reconnect once according to the existing market runner;
- CAPTCHA/MFA remains human-controlled;
- no second refresh may use the same market/environment/slot profile concurrently;
- verification happens before packaging;
- rejected verification cannot be packaged or published;
- no session contents are printed by the regional orchestrator.

## Expected duration
If four independent refreshes each take roughly four minutes, sequential operation may take roughly sixteen minutes. With regional parallel execution, total duration approaches the slowest selected market instead of the sum, subject to Samsung response time, CAPTCHA/MFA and local machine resources.

## Validation
Static contract tests:

```bash
node --test governance/tests/authRefreshRunner.test.cjs governance/tests/authRefreshAllRunner.test.cjs
```

First runtime validation should run S2 for all four markets and confirm:

- four dedicated market Chrome profiles are used;
- no profile collision error occurs between different markets;
- each market reaches its own verify/package stage independently;
- a CAPTCHA/MFA in one market does not terminate the others;
- READY is printed only for markets that completed the full individual pipeline.

## Combined Jenkins and SECOND shortcuts

- `node scripts/auth-refresh-all.cjs`: PRIMARY for MX, PE, CO and CL.
- `node scripts/auth-refresh-all-jenkins.cjs`: the same refresh followed by each market's Jenkins publication.
- `node scripts/auth-refresh-second.cjs`: SECOND for MX and CO only.
- `node scripts/auth-refresh-second-jenkins.cjs`: SECOND refresh followed by Jenkins publication.

All commands default to S2; set `AUTH_REFRESH_ENVIRONMENT=S1` for S1. The SECOND shortcuts use dedicated SECOND credentials when configured, otherwise keep manual identity selection; they never reuse PRIMARY credentials. CAPTCHA/MFA remains manual.

Publishing requires all three `JENKINS_URL`, `JENKINS_USER` and `JENKINS_API_TOKEN` environment variables together, or the existing ignored `playwright/.auth/jenkins-publisher.local.json` with `url`, `user`, and `apiToken`. The orchestrator checks this configuration before opening browsers. Explicit environment configuration is never mixed with saved credentials.

Visible email fields are populated once when automatic login is configured. Password and submission wait for any CAPTCHA challenge to be completed. No credentials are entered into MFA forms. Each dedicated native browser closes only after verification, packaging and requested publication succeed. A failed or human-gated flow preserves its window for recovery. Shared PreQA2 Chrome is never closed by this cleanup.

## Regional keep-alive (S2 by default)

Run `node scripts/auth-keepalive-once.cjs`. It checks MX PRIMARY/SECOND, PE PRIMARY, CO PRIMARY/SECOND and CL PRIMARY in parallel. Two positively signed-out checks are required before interactive renewal. Network failures and inconclusive UI checks never trigger login. Healthy checks do not open Samsung Account; they persist verified browser and session state before packaging.

`--environment=S1` selects S1. `--markets=cl,pe` explicitly limits both Jenkins activity checking and all auth work to those markets. PE/CL have no SECOND keep-alive lane. CO never inherits MX_AUTH_SLOT. `--no-publish` disables publication, without acknowledging unsent changes.

Each market holds a coordination lease through verification, renewal, package and publication. Jenkins auth batches participate in the same lease; an active/queued Samsung build also makes the one-shot exit BUSY before authentication begins. Different markets remain independent. Unknown lock ownership fails closed.

Publication compares session content with the last successfully acknowledged publication. Bookkeeping timestamps alone do not rewrite bundles. Failed publications remain pending for a later cycle. With no publication checkpoint, the first successful cycle publishes once to establish that baseline. Checkpoints contain hashes/status only and are ignored local artifacts.

Exit codes: 0 all READY, 2 HUMAN_REQUIRED, 3 BUSY, 1 failed or unproven. HUMAN_REQUIRED preserves the native browser and suppresses repeated automatic login attempts. The next cycle resumes that existing window without restarting login or repeating an attempted password. A private READY/CHALLENGE marker permits one continuation of the retained email step after a positively observed completed challenge; an unknown email phase remains manual. Empty email-to-password transitions are awaited within the same deadline. After the operator completes verification, it exports, verifies in a fresh context, packages and publishes changes, then closes only the bound native window. An unknown password attempt remains manual. An inaccessible CDP endpoint alone never proves that a browser was closed.

For Windows, use Task Scheduler rather than a permanent Node loop or a Jenkins service login session. `node scripts/auth-keepalive-task.cjs --print` previews the definition; `--install` registers an immediate user-logon trigger plus a 15-minute one-shot only after a recent successful real six-identity cycle. `--update-schedule` migrates an existing enabled managed installation only when its owner, executable, arguments, working directory and IgnoreNew policy match and no instance is running. This migration does not claim current authentication is valid. `--remove` removes the keep-alive task. Configuration refuses active/queued Samsung builds.

The task uses the logged-in operator (InteractiveToken), no stored Windows password, IgnoreNew, and a 75-minute outer execution limit. This ceiling covers two waves of strict health checks, two FIRST recovery waves, one SECOND wave, and package/publication; individual child timeouts remain unchanged. The trigger remains every 15 minutes, and IgnoreNew skips overlapping starts while recovery is in progress. It needs that user logged in and network access. CAPTCHA/MFA remains manual. Scheduling does not guarantee indefinite session validity and never bypasses Samsung verification. Local evidence is in ignored `test-results/auth-keepalive/last-cycle-s2.json`; partial runs cannot authorize scheduler installation.

Scheduled tasks use the Windows GUI host (`wscript.exe`) and a bounded launcher that waits for Node and propagates its exit code, avoiding flashing console windows. Chrome remains visible when human intervention is required. For an existing managed installation, `node scripts/auth-keepalive-task.cjs --hide-consoles` migrates only the keep-alive action while preserving triggers, owner and settings. Include the existing `--dashboard-output` to migrate both tasks, or add `--dashboard-only` to migrate just reporting. Migration refuses running tasks and active/queued Samsung builds.

Interactive recovery allows up to ten minutes by default for human verification, still bounded by the task execution limit. `AUTH_KEEPALIVE_INTERACTIVE_TIMEOUT_MS` can shorten this deadline; values above ten minutes are capped. A failed or human-gated recovery records the dedicated window fingerprint for later cleanup. The window closes only after a subsequent verified, successfully finalized recovery, and only if its fingerprint still matches. Missing proof preserves the window rather than closing another browser.

Email reads/fills use short bounded waits so a provider transition cannot stall on an obsolete email field for the page-wide timeout. A stale email timeout advances only when the password field has positively appeared; it never repeats a submitted Next or password action. Each completed recovery child immediately checkpoints its final human-handoff audit before other markets finish, preserving proof that a password has not yet been submitted even if the scheduler is interrupted later.
Health checks use up to four parallel Chromium contexts. FIRST checks and recoveries run before SECOND checks, so an expired SECOND does not delay opening the four FIRST recovery windows at startup. At most four independent FIRST windows can wait for the operator; SECOND still has only MX/CO. All six identities remain covered; healthy sessions are never refreshed to fill a lane.

The login helper submits each credential step once. It fills email, attempts the normal CAPTCHA checkbox once when present, and waits for any real challenge/MFA. It fills password and submits only after the challenge has been completed. It never solves a challenge or resubmits failed credentials. The invisible reCAPTCHA badge never blocks Next or password submission; visible checkbox/visual challenges remain gates. If Samsung clears the configured email when opening a challenge, the helper restores the empty field once. MX/CO SECOND uses the normal QR option when running in manual mode: scan it with the SECOND account. It can also auto-fill when dedicated SECOND credentials are explicitly configured; it never falls back to PRIMARY credentials. Keep SECOND credentials only in the existing ignored local credential files or dedicated environment variables.

Visible renewal phases are FIRST before SECOND, with an explicit phase message. A pending FIRST human gate defers new SECOND login windows. PE/CL finalize, publish if changed, close verified owned browsers and release their market leases after the FIRST phase, without waiting for MX/CO SECOND intervention. A human/failed flow preserves its browser for recovery.

After overnight sleep or shutdown, Samsung may legitimately expire sessions; the scheduler cannot extend them while the machine is not executing. Two confirmed signed-out checks trigger recovery. A manual regional refresh can return BUSY while that scheduled recovery owns the profiles: this is coordination, not a new proof of expiration. Do not delete live lease files or repeatedly start refresh commands. Complete the already-open FIRST gates, then SECOND when prompted. Network/unproven checks remain distinct from signed-out results and never force a login.

The valid Samsung `getcookie.html` can retain the legacy title `Error: Page Under Maintenance` while visibly granting access with `You can access pages now`. A title alone must never classify an outage. The guard requires maintenance content in the visible body and no access confirmation; it accepts a valid bootstrap and still requires positive authenticated/logout proof on the home. Genuine maintenance remains a transient outcome (21), never proof of expiration. This applies to all four markets in S1/S2.

Verification failures carry an allowlisted reason through the child protocol and dashboard, without error text or session data. `AUTHENTICATION NOT CONFIRMED` highlights unverifiable identities even when the scheduler is running. A closed browser is not proof of authentication: healthy sessions stay silent, two confirmed signed-out checks renew only that identity, and availability failures do not initiate another login.

## Read-only auth operations dashboard

`node scripts/auth-operations-dashboard.cjs` renders separate Base Store and EPP identity tables from allowlisted metadata, actual Task Scheduler configuration and Jenkins GET activity. It never verifies, refreshes, publishes credentials, starts builds or opens browsers. Reports are atomic and failures do not change authentication outcomes. History is bounded to 30 days / 3,000 cycle records; malformed records are counted and skipped. No email, UID, password, cookie, token or bundle contents are collected.

For the local Jenkins installation, add `--dashboard-output=C:\ProgramData\Jenkins\.jenkins\userContent\samsung-smb-auth\s2` to the task installer/update command. It registers a separate read-only one-minute reporting task, also with user logon and IgnoreNew. Open `http://localhost:8080/userContent/samsung-smb-auth/s2/index.html`. The page requests a 45-second same-origin refresh; actual browser behavior remains subject to Jenkins CSP. No global CSP relaxation is required.

The dashboard separates health from current operation: HEALTHY can coexist with VERIFYING. Age comes from the last successful verification; old proof becomes STALE, never expired solely by age. Explicit invalid-session evidence establishes EXPIRED. An unresolved human gate stays highlighted through later BUSY cycles. EPP entitlement requires independent accepted identity/access proof, with external code/corporate prerequisites distinguished from CAPTCHA. Separate scheduler panels and the last completed cycle avoid confusing an active cycle with completed verification. The recent-events table shows at most 20 entries. Identity independence is not inferred from successful login. Logon trigger configuration is separate from evidence of an actual Windows logon execution.

### Real Windows logon trigger qualification — 2026-10-25

The installed `SamsungSMB-AuthKeepAlive-S2` **At log on trigger is runtime-qualified**. All times below are America/Sao_Paulo. No manual task start, keep-alive, refresh or verification was executed for this qualification.

- Windows TerminalServices event 23: session 1 logged off at 21:01:30.873; event 21: session 2 logged on at 21:01:48.512.
- TaskScheduler event **119** recorded user-logon activation at 21:01:51.998; event 100 started instance `386c9bf0-f8c4-4554-b025-161a41042e6c` at 21:01:52.017. The cause was logon, not time-trigger event 107 or manual-request event 110.
- The previous instance finished at 21:00:14.112. Exactly one instance ran during this logon cycle, with `IgnoreNew` preserved; event 102 recorded its completion at 21:08:59.022.
- Application cycle: 21:01:58.119–21:08:43.879. `LastTaskResult=1`: MX PRIMARY, PE PRIMARY, CO PRIMARY/SECOND and CL PRIMARY were `TRANSIENT_ERROR`; MX SECOND was `UNPROVEN`, after two checks each. All four publications were `SKIPPED`. This qualifies startup execution, **not six healthy sessions or successful session renewal**.
- Subsequent diagnosis found a false maintenance-title guard in these checks: the legacy bootstrap title was rejected despite its visible access confirmation. That automation defect was corrected; these historical outcomes must not be treated as proof of a Samsung outage. The event-based logon qualification remains valid.
- The independent dashboard reporter updated its files after logon. The enabled recurring trigger remains `PT15M`; the next scheduled time at cycle completion was 21:10:31.

Event correlation and safe runtime metadata are preserved locally in ignored `.agent/tmp/at-logon-runtime-proof.json` and the AuthOperations cycle store. No session material belongs in this evidence.

The dashboard presentation uses local SVG country marks, separate FIRST/SECOND badges, text-labelled health meters and a reduced-motion responsive layout. `countdown.js` updates display text from the recorded next-run timestamp. Embedded reports additionally read their own signed document every 45 seconds with redirects rejected; no session storage, auth actions or schedule changes are performed. If scripting is restricted by Jenkins CSP, the absolute scheduled time remains visible. Jenkins resource-domain page refresh uses the configured canonical Jenkins origin and the fixed read-only dashboard path, without changing CSP or Jenkins security. Market execution displays only the market names present in the existing metadata; build numbers are not inferred. HTML Publisher retains its safe intermediate access page because Jenkins serves reports on an isolated resource domain.

The UI labels current healthy identities separately from historical identity-check outcomes; the percentage is not platform uptime or the fraction of fully healthy cycles. Current status and the last recorded action are displayed separately. SECOND waiting labels name their corresponding FIRST market. Activity filters operate only on the 60 events already rendered, with categories derived from those events; no scheduler event is invented. A generation-age indicator updates locally alongside the existing countdown, without adding requests or changing the 45-second refresh. If Jenkins CSP blocks scripts, all events and the absolute generation time remain available.

For access from another device on the LAN, keep the credential-bearing publisher URL on HTTPS or loopback HTTP. The ignored publisher configuration may additionally contain `dashboardOrigin` (or use `AUTH_OPERATIONS_REFRESH_ORIGIN`) with the canonical browser-facing Jenkins origin. This display-only value controls the fixed dashboard refresh destination; it never changes API requests or credential publication. Jenkins must use a separate, reachable resource hostname. Without a canonical origin, the page reloads its existing document rather than sending a root-relative path to the isolated resource domain.

An unresolved retained FIRST browser also defers visible SECOND recovery, including when the FIRST worker exited with FAILED before reporting a human gate. Silent verification failures without a retained interactive browser still remain isolated by market.

Login readiness: a credential field that appears between asynchronous visibility checks must be filled before its submit branch can run. The profile menu trigger may share data-an-la=login with the real sign-in action; only the sign-in action is eligible. Official /iam/error authorization pages fail promptly and are discarded only by a subsequent fresh refresh, preserving live CAPTCHA/MFA pages and the dedicated Chrome.

## EPP maintenance exit codes

The EPP one-shot uses the same coordination codes in S1 and S2: `0` for a successful cycle, `2` for human intervention, `3` when occupied leases defer otherwise healthy maintenance, and `1` for failures or unproven results. BUSY remains BUSY in the report and never becomes HEALTHY. A failure mixed with BUSY still returns `1`; human intervention takes precedence with `2`.

Runtime audit on 2026-11-07: the automatic S2 EPP cycle started at 18:47 local and completed at 18:49 with four independently verified programmes, reused sessions and exit `0`. A controlled PE lease conflict returned `3` without starting refresh or publishing, and preserved the regional report. The Base Store cycle independently reported six healthy identities. These observations do not guarantee future session validity: CAPTCHA/MFA and genuine expiry retain their existing recovery rules. Financial submission status is separate from identity health; maintenance did not alter the pending PE payment marker.

## EPP operator refresh recovery — 2026-11-08

`npm run auth:refresh:epp:all` selects the four operational S2 programmes, verifies before recovery and publishes only independently proven bundles. Progress now appears per market while the cycle runs, including an observed human gate. The final summary distinguishes READY 4/4 (exit 0), HUMAN_REQUIRED (2), BUSY (3), and NOT_READY (1); a timeout is never labelled authenticated.

A read-only snapshot check that returns a recognised transient network/navigation/deadline failure is checked once more before deciding it is unproven. This retry neither submits credentials nor repeats activation. An audited existing human handoff retains its resume behavior. Two matching definitive identity rejections are still required before a new recovery, and current programme/security blockers remain protected.

The operator failure on November 8 contained different causes: CO recovered successfully, PE verification exceeded its deadline, and MX/CL recovery encountered staging navigation timeouts. A scheduled recovery also occupied PE while the manual cycle was checking other markets; its live lease was preserved. After one legitimate MX CAPTCHA, password/submit continued automatically, independent verification succeeded and its owned window closed. PE/CO recovered through maintenance, and CL subsequently verified without a new CAPTCHA. The actual regional command then completed with four KEEP_ALIVE_OK results and exit 0, reusing all four snapshots. Evidence is retained locally; no payment, Production operation or session material is part of this delivery. This is runtime S2 evidence, not a guarantee against future Samsung expiry or external outages.


## Dashboard embedded refresh — 2026-11-08

Chrome showed a public-resource-to-private-network navigation block inside the HTML Publisher iframe. The embedded view no longer navigates on its meta-refresh. It reads only its current signed report document (10-second timeout, no redirects, no-store), validates the expected dashboard title and replaces the document only on success. Its previous timer is cleared before replacement. Expired redirects, non-success HTTP and login/error HTML preserve the last good view with an explicit unavailable-update notice and an Open live dashboard link targeting the top-level window. Top-level live dashboards retain canonical navigation to renew the signed URL. No resource-domain, job, credential, CSP or auth configuration was changed.

Reporting validation: 77/77 tests PASS, zero skips, including actual Chromium iframe replacement and expired-redirect retention fixtures. Real Jenkins validation survived consecutive automatic updates, recorded three same-document refresh requests and a generation timestamp change from 21:30:34Z to 21:32:34Z on November 8; desktop and 390px mobile rendered without horizontal overflow. This proves the real update path, not indefinite validity of a signed URL. A report already showing the old Chrome error needs one reload/open of the live dashboard to load the new code; a genuinely expired embedded URL requires the visible top-level live link. The reporter does not bypass Jenkins authentication or browser network protections.

## Samsung Account security denial — 2026-11-08

The retained PE S2 Base Store profile was independently observed on the official `/iam/blocked` page with the access-denied title. This is a provider security denial, distinct from CAPTCHA and from the separately healthy EPP programmes. The shared login helper now fails immediately with `AUTH_SECURITY_BLOCKED`, before credential actions. EPP preserves its existing external-blocker classification.

Before Base Store keep-alive recovery or retained-handoff continuation, a read-only probe may inspect only the exact profile's local debugging inventory. It validates the endpoint's current browser identifier before checking official Account page URLs; it never attaches CDP, closes a browser, navigates, submits credentials or exposes URLs with query strings. A proven denial returns `HUMAN_REQUIRED / SAMSUNG_ACCOUNT_SECURITY_BLOCKED`, preserves the handoff, and starts no login child. Healthy verification still takes precedence because this gate runs only when recovery/continuation is needed. The dashboard requests official Samsung security review rather than a CAPTCHA for that reason. Unknown/unreachable inventories are not falsely classified as security denials.

Validation: 456 integrated auth, Base Store, EPP and reporting tests passed without skips. The real PE profile returned the typed security gate with zero login children. The protection recognises and respects the denial; it cannot lift Samsung's security decision. No new PE login, browser close, security bypass or payment was attempted. Scheduled processes already running before deployment may finish using their loaded code; subsequent cycles use this protection.

## Dashboard refresh/cache follow-up — 2026-11-09

The operator's actual HTML Publisher tab again showed Chrome's public-to-private iframe navigation block to the LAN display origin. Reload loaded the current implementation, but the generated HTML still carried a declarative meta refresh and unversioned script/style URLs. This left navigation dependent on timely execution of the latest script; previously cached presentation code could retain the old behavior.

The generated document now has no meta refresh at all. Both embedded and top-level views refresh only their current document through the existing bounded, redirect-rejecting read-only fetch. Failure retains the last good dashboard and its explicit top-level live link. CSS/JS URLs include a hash of their contents, so a changed asset cannot silently reuse an older cached URL. Layout, authentication, keep-alive, schedules, jobs and CSP are unchanged.

Validation: 75 reporting tests PASS, zero skips, including Chromium iframe updates and expired-redirect retention. Actual Jenkins signed report survived two automatic same-document requests; generation changed from 2026-11-09T11:33:17.674Z to 2026-11-09T11:35:31.352Z. Desktop and 390px mobile passed without horizontal overflow. Public files and the current job-level report mirror were updated; no historical build or auth operation changed. This does not extend Jenkins signed-link lifetime or bypass login: genuine expiry is displayed while retaining the last good view.

## Terminal authorization windows and scheduler exit codes — 2026-11-09

Observed CL Base Store S2 retained /iam/error/authorize (No se ha podido iniciar sesión) together with its getcookie bootstrap tab. Resume returned HUMAN_REQUIRED before reaching terminal-error handling when password submission had already been attempted. It therefore kept an unusable window indefinitely.

The shared Account flow and retained-handoff reader now close only a positively identified official /iam/error attempt. The whole dedicated window is closed only when every tab is that terminal error, blank, or the staging getcookie page; another live tab restricts cleanup to the rejected page. Identity is checked again after CDP setup so a newly rendered challenge is preserved. No credential replay occurs. Base Store records the ended handoff, and EPP clears the stale handoff without publishing or marking READY. FIRST and QR/SECOND keep the same safety boundaries. Existing CAPTCHA/MFA, /iam/blocked security review, healthy storefront and foreign pages remain open.

Actual owned CL S2 terminal window was closed under market/profile leases, returning AUTHORIZATION_EXPIRED with loginStarted=false; the subsequent read-only inventory retained only the separate PE Samsung security-blocked window. No task restart or new login was triggered by cleanup.

Task exit code 2 now displays ACTION REQUIRED, code 3 BUSY, successful idle code 0 READY, active execution RUNNING; other technical errors retain ERROR. Existing EPP external-prerequisite review remains distinct. Unknown scheduler metadata remains UNKNOWN rather than invented success. Raw exit codes remain visible in the schedule panel. Tasks, triggers, credentials and auth acceptance were not changed.

Validation: 911 integrated auth/EPP/reporting tests PASS, zero failures/skips; final race-focused validation 90 PASS. Real Jenkins desktop/mobile rendered without overflow; this validation did not claim renewed sessions or bypass the PE security denial.
