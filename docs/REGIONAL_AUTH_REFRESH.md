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

The task uses the logged-in operator (InteractiveToken), no stored Windows password, IgnoreNew, and an 18-minute execution limit. It needs that user logged in and network access. CAPTCHA/MFA remains manual. Scheduling does not guarantee indefinite session validity and never bypasses Samsung verification. Local evidence is in ignored `test-results/auth-keepalive/last-cycle-s2.json`; partial runs cannot authorize scheduler installation.

Scheduled tasks use the Windows GUI host (`wscript.exe`) and a bounded launcher that waits for Node and propagates its exit code, avoiding flashing console windows. Chrome remains visible when human intervention is required. For an existing managed installation, `node scripts/auth-keepalive-task.cjs --hide-consoles` migrates only the keep-alive action while preserving triggers, owner and settings. Include the existing `--dashboard-output` to migrate both tasks, or add `--dashboard-only` to migrate just reporting. Migration refuses running tasks and active/queued Samsung builds.

Interactive recovery allows up to ten minutes by default for human verification, still bounded by the task execution limit. `AUTH_KEEPALIVE_INTERACTIVE_TIMEOUT_MS` can shorten this deadline; values above ten minutes are capped. A failed or human-gated recovery records the dedicated window fingerprint for later cleanup. The window closes only after a subsequent verified, successfully finalized recovery, and only if its fingerprint still matches. Missing proof preserves the window rather than closing another browser.

Email reads/fills use short bounded waits so a provider transition cannot stall on an obsolete email field for the page-wide timeout. A stale email timeout advances only when the password field has positively appeared; it never repeats a submitted Next or password action. Each completed recovery child immediately checkpoints its final human-handoff audit before other markets finish, preserving proof that a password has not yet been submitted even if the scheduler is interrupted later.
Health checks use up to three parallel Chromium contexts; interactive renewals use up to two simultaneous windows to avoid exhausting desktop memory when multiple identities expire together. All six identities remain covered; healthy sessions are never refreshed to fill a lane.

The login helper submits each credential step once. It fills email, attempts the normal CAPTCHA checkbox once when present, and waits for any real challenge/MFA. It fills password and submits only after the challenge has been completed. It never solves a challenge or resubmits failed credentials. The invisible reCAPTCHA badge never blocks Next or password submission; visible checkbox/visual challenges remain gates. If Samsung clears the configured email when opening a challenge, the helper restores the empty field once. MX/CO SECOND uses the normal QR option when running in manual mode: scan it with the SECOND account. It can also auto-fill when dedicated SECOND credentials are explicitly configured; it never falls back to PRIMARY credentials. Keep SECOND credentials only in the existing ignored local credential files or dedicated environment variables.

Visible renewal phases are FIRST before SECOND, with an explicit phase message. A pending FIRST human gate defers new SECOND login windows. Health checks remain parallel (up to three Chromium contexts); renewal is limited to two concurrent windows to bound desktop resource usage. Successful refresh closes its dedicated native browser; a human/failed flow preserves it for recovery.

## Read-only auth operations dashboard

`node scripts/auth-operations-dashboard.cjs` renders six identity cards from allowlisted metadata, actual Task Scheduler configuration and Jenkins GET activity. It never verifies, refreshes, publishes credentials, starts builds or opens browsers. Reports are atomic and failures do not change authentication outcomes. History is bounded to 30 days / 3,000 cycle records; malformed records are counted and skipped. No email, UID, password, cookie, token or bundle contents are collected.

For the local Jenkins installation, add `--dashboard-output=C:\ProgramData\Jenkins\.jenkins\userContent\samsung-smb-auth\s2` to the task installer/update command. It registers a separate read-only one-minute reporting task, also with user logon and IgnoreNew. Open `http://localhost:8080/userContent/samsung-smb-auth/s2/index.html`. The page requests a 45-second same-origin refresh; actual browser behavior remains subject to Jenkins CSP. No global CSP relaxation is required.

The dashboard distinguishes missing/stale evidence, BUSY, HUMAN_REQUIRED, verification failures, package/publication failures and scheduler degradation. An unresolved human gate stays highlighted through later BUSY cycles. The success percentage describes observed check outcomes, not measured uptime. Session age is shown only when a refresh timestamp is known; identity independence is not inferred from successful login. Logon trigger configuration is separate from evidence of an actual Windows logon execution.

The dashboard presentation uses local SVG country marks, separate FIRST/SECOND badges, text-labelled health meters and a reduced-motion responsive layout. `countdown.js` updates only display text from the recorded next-run timestamp: no requests, storage, auth actions or schedule changes. If scripting is restricted by Jenkins CSP, the absolute scheduled time remains visible. Jenkins resource-domain page refresh uses the configured canonical Jenkins origin and the fixed read-only dashboard path, without changing CSP or Jenkins security. Market execution displays only the market names present in the existing metadata; build numbers are not inferred. HTML Publisher retains its safe intermediate access page because Jenkins serves reports on an isolated resource domain.

The UI labels current healthy identities separately from historical identity-check outcomes; the percentage is not platform uptime or the fraction of fully healthy cycles. Current status and the last recorded action are displayed separately. SECOND waiting labels name their corresponding FIRST market. Activity filters operate only on the 60 events already rendered, with categories derived from those events; no scheduler event is invented. A generation-age indicator updates locally alongside the existing countdown, without adding requests or changing the 45-second refresh. If Jenkins CSP blocks scripts, all events and the absolute generation time remain available.

For access from another device on the LAN, keep the credential-bearing publisher URL on HTTPS or loopback HTTP. The ignored publisher configuration may additionally contain `dashboardOrigin` (or use `AUTH_OPERATIONS_REFRESH_ORIGIN`) with the canonical browser-facing Jenkins origin. This display-only value controls the fixed dashboard refresh destination; it never changes API requests or credential publication. Jenkins must use a separate, reachable resource hostname. Without a canonical origin, the page reloads its existing document rather than sending a root-relative path to the isolated resource domain.
