# Isolated EPP session maintenance

EPP maintenance never imports Base Store cookies, storage or bundles. It reuses
the shared lease, browser lifecycle, hidden task launcher and Jenkins activity
guard. PRIMARY means FIRST. SECOND is supported only for MX/CO and requires its
own provisioned identity; it never falls back to FIRST credentials.

## Operator commands

```powershell
# Verify/package existing EPP FIRST sessions only; no login or publication.
npm run auth:keepalive:epp

# Recover only proven invalid sessions, publish changed EPP bundles.
npm run auth:keepalive:epp -- --allow-refresh --publish

# Explicit S1 or selected market; S2 is the default.
npm run auth:keepalive:epp -- --environment=S1 --markets=MX

# SECOND recovery requires a fresh complete FIRST phase; never mixed windows.
npm run auth:keepalive:epp -- --slot=second --allow-refresh --publish

# Inspect/repair only the Jenkins resource-domain address.
npm run auth:operations:resource:check -- --apply

# Generate task XML, without registering or running it.
node scripts/auth-epp-keepalive-task.cjs --print

# Register only after fresh regional runtime evidence satisfies the gate.
npm run auth:keepalive:epp:install
```

The independent task is `SamsungSMB-EppAuthKeepAlive-S2`: current interactive
Windows user, logon trigger, 15-minute repetition, IgnoreNew, hidden launcher,
no Windows password. Registration is gated by a fresh complete regional cycle
including a real healthy EPP session; generated XML is not proof of registration,
a real logon, or successful 15-minute execution. Do not mark it homologated until
those operations have runtime evidence. Base Store scheduling remains separate.

The task ceiling is 30 minutes: two concurrent market lanes may each wait up to
10 minutes for a human challenge, in two FIRST waves, plus independent checks.
This is a bounded one-shot, not a resident login loop. If a cycle crosses the
15-minute boundary, IgnoreNew skips overlap. A retained challenge is resumed
without restarting credentials; a timed-out/expired challenge still needs an
explicit operator decision rather than automatic repeated login.

## Decisions and safety

- Healthy means independent server identity, programme access and storefront
  evidence. It is verified, persisted and packaged without opening Account.
- Two matching explicit identity rejections permit one controlled recovery.
  Network/context uncertainty is UNPROVEN, never an automatic login trigger.
- Existing audited human handoffs may resume in their exact retained browser;
  a missing browser does not silently restart login. An explicit operator refresh
  may establish a new attempt after expiry.
- CAPTCHA/MFA/QR remain human gates. Credentials are never replayed after an
  ambiguous password submission. Successful owned windows close after proof and
  publication; genuine human gates remain open.
- External code, activation, entitlement, security and Production blockers are
  memoized. Verification still runs; a now-healthy proof clears the blocker.
  Otherwise maintenance does not repeat code/activation/login. A memo is labelled
  CHECKPOINT, not a claim that a new network read reproduced the old defect.
- FIRST visible recovery must complete before SECOND. EPP scheduled scope is the
  four FIRST identities; SECOND is explicit and defaults to MX/CO only.
- Same-market EPP leases cover both slots. Active Jenkins builds return BUSY
  before any session mutation. Unknown lease ownership is never forcibly cleared.
- EPP bundles have an explicit store/market/environment/slot/programme envelope.
  Base Store bundle installers reject them. Canonical hashes ignore cookie order,
  not contents. Jenkins credentials are `samsung-epp-<market>-<env>-<slot>-session-bundle`.
  Identical acknowledged bundles are not republished. A failed publish never
  advances the acknowledgement hash.

## CI integration

Market Base Store Jenkins jobs are not repurposed as EPP jobs. An EPP lane may bind
its own file credential to `EPP_SESSION_BUNDLE_FILE`; `run-epp-qst.cjs` then runs
the isolated preflight before tests. `EPP_AUTH_PREFLIGHT=1` also enables verification
of local EPP state. Preflight verifies/installs only; it never refreshes on CI.
List/discovery does not read private fixtures or perform preflight. Keep runtime
data exclusively in ignored `playwright/.auth/epp/runtime-data.json`.

## Observability and limitations

Runtime evidence on 2026-10-28 (America/Sao_Paulo): the S2 task's manual integration
run started 14:50 and completed 14:53. Its independent periodic run started 15:17
and completed 15:20; Task Scheduler recorded events 107/100/200 and 201/102.
The task returned to Ready, IgnoreNew remained configured, and the next boundary
was 15:32. No manual cycle was dispatched for the 15:17 boundary. The summary
proved MX S2 KEEP_ALIVE_OK/SERVER_ACCEPTED without Account, and preserved the
three documented external blockers. Exit 1 reflects those BLOCKED results.
An actual Windows logoff/logon was not performed for this new EPP task; its
logon trigger is configured but not runtime-homologated. S1 remains explicit
on-demand maintenance; no S1 task was registered in this round.

Safe cycle output is `test-results/auth-keepalive/epp-last-cycle-<env>-<slot>.json`.
It contains classifications/proof flags, never credentials or bundle contents.
Base Store dashboard six-identity KPIs are not EPP entitlement proof.
Exit codes are 0 for all healthy, 2 for a human gate, 3 for an occupied build/phase,
and 1 for blocked/unproven/finalization failures. A task result of 1 therefore
requires the typed summary: a documented external EPP blocker is not evidence
that the Windows trigger failed or that every session is expired.

The Auth Operations item remains an observer-only HTML Publisher job, displaying
the complete dashboard with local CSS and countdown assets. Its finite builder
copies only the three public dashboard files; it performs no authentication.
An explicitly enabled local report mirror updates only the current job-level
public report, never historical builds, credentials or session files. Its NTFS
write permission must be granted explicitly to the reporting user.
Base Store health and current operations are independent. EPP has its own table,
using maintenance summaries, independently verified identity metadata and typed
checkpoints; Samsung Account login alone never proves EPP entitlement. Old proof
becomes STALE, not EXPIRED. Missing browser/email phase data is not invented.
The public link uses the configured display origin. Resource repair changes only the Jenkins isolated
resource URL to a currently assigned local address, preserving CSP/auth settings.
No new plugin or market execution is required. Real iPhone reachability and
Windows logon execution require separate device/runtime evidence.
