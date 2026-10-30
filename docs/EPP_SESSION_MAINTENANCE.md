# Isolated EPP session maintenance

Independent verification starts with the same staging origin's
`/getcookie.html`, confirms `You can access pages now`, and only then opens the
programme. Existing identity storage does not replace staging routing setup.
SystemParking observed without setup cannot prove expired authentication.
Cookie/navigation timeouts must remain distinct from rejected credentials;
they must not start repeated login attempts. The cookie-first sequence has a
regression test covering an already saved identity without a login window.

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

## Programme-aware routing and evidence

Use the existing configuration, selecting an approved programme explicitly with
`CO_EPP_PROGRAM=alianzas_co` (or the corresponding market variable). CO S2 priority
is alianzas_co, then estudiantes_co; co_epp_agre is retained as a known blocked
programme, never an automatic fallback. PE short routes are independent candidates
with unproven entitlement; Yape has a single-inspection checkpoint, no registration
or email retry. CL alianzas and existing MX roots remain represented.

Alternative programmes use `playwright/.auth/epp/<env>/<market>/programs/<id>/`
and profiles under `playwright/profiles/epp/programs/<id>/`. FIRST/SECOND remain
separate. Legacy programmes keep their existing paths and credential IDs.
Alternative bundle names/credential IDs include the programme suffix; a bundle
for one root cannot be installed as another. Ignored runtime data for alternatives
belongs in `<env>.<market>.programs.<id>`, never inherited from another programme.
Market/environment leases still serialize shared account use across programmes.

`node scripts/inspect-epp-program.cjs CO S2 alianzas_co` performs a bounded,
read-only programme inspection. It never logs in, requests activation, submits a
code, changes a cart or pays. Same-market EPP state can seed inspection, but only
fresh exact-programme server identity/access and storefront proof can produce a
verified export. No Base Store state is imported. Safe observations are stored
beside the programme metadata as `program-observation.json`; no response bodies,
tokens, emails or session contents are recorded. Yape refuses a second automatic
inspection after this checkpoint exists.

Visible refreshes are serialized. Once a human gate remains pending, later
identities may be verified silently but no second login window is started.
Blocked programme policy prevents automatic login before profile/bundle changes.
Account activation dialogs support both Continuar comprando and Seguir comprando
only after an actual verified-account success message.

Auth Operations reads the same registry, maintenance summaries, per-programme
identity metadata and safe observations. Programme health is never shared across
siblings. Callback behaviour is shown separately; registration, identity,
entitlement and storefront remain distinct. Regional task activity does not
invent a per-programme in-progress step. No Jenkins job/CSP/task configuration
change is required by this routing code.

The common CO Samsung identity header may be used inside the isolated EPP profile
when a programme registration page has no account control. This creates a fresh
Samsung identity there; it imports no Base Store state, and is never EPP proof.
After its callback, the exact programme identity/access and authenticated UI are
verified independently before any EPP export. A verified programme greeting can
prove the landing UI without an account menu; a greeting alone never proves
identity or entitlement, nor product/cart/checkout functionality.

### Scoped native capture and bounded verifier cleanup

Recovery first checks an existing exact owned EPP native profile, then independently
verifies its snapshot before replacing an older export. Capture reads cookies and
the current staging programme's local/session storage in place; it does not use
full storageState origin navigation. Capture and disconnect have deadlines so an
unresponsive browser cannot retain a market lease indefinitely. Only the newly
created headless verifier's owned ChildProcess can be terminated during cleanup.
Native human-intervention windows are not terminated by that cleanup.

After an actual Samsung callback reaches same-origin SystemParking, recovery
uses getcookie then the canonical EPP root in the same context. It never repeats
the password submit. Existing visible getcookie readiness is reused. A greeting
or checkAccess=true without independently accepted identity remains unproven.
