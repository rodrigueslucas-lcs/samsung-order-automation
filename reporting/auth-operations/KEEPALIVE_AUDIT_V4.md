# EPP S2 keep-alive audit — dashboard V4

Scope: read-only repository inspection on 2026-11-04. This document does **not** certify a successful end-to-end Windows scheduled-task run or a live EPP authentication recovery.

## Verified implementation facts

- The Windows EPP task XML is defined in `utils/authKeepAliveTask.cjs`: `auth-epp-keepalive-once.cjs --environment=S2 --scheduled --allow-refresh --publish --repair-dashboard`, triggered every 15 minutes. The task is configured as interactive with IgnoreNew overlap protection. This proves intended configuration, not a currently installed task.
- `scripts/auth-epp-keepalive-once.cjs` checks Jenkins market activity before invoking `utils/eppKeepAlive.cjs` and writing `test-results/auth-keepalive/epp-last-cycle-s2-primary.json`.
- `utils/eppKeepAlive.cjs` verifies the programme-specific existing EPP session first. It attempts recovery only for sufficiently confirmed invalid identity when `allowRefresh` is true, the policy permits it, and there is no external/checkpoint blocker. The dedicated child drives the CAPTCHA/human handoff. Some BLOCKED/UNPROVEN results must **not** launch a browser automatically.
- The EPP cycle calls `getEppConfig(market, env)` with no explicit programme override beyond environment variables. A configured dashboard primary programme is not itself a runtime selector. On 2026-11-04, `co_epp_agre` was selected for the S2 dashboard, but `config/markets/epp.js` still listed historical `BLOCKED_CALLBACK_TO_PRODUCTION` policy and `allowAutomaticRetry=false`. **Do not lift this safeguard without programme-specific staging auth/callback proof**.
- The task can return exit code 1 when its summary includes non-healthy programme results. Exit code 1 alone is not sufficient to conclude that the Windows scheduler failed. V4 displays REVIEW in that specific case, retaining programme health/reasons separately.
- EPP `HEALTHY` requires recent per-programme user identity and entitlement acceptance (and a successful verification/result), not successful QST orders or `READY/IDLE` scheduler state.
- The dashboard now selects S2 rows only for its primary EPP cards: observed S1 evidence can no longer be promoted into a S2 primary row.
- The headline counts one active programme per market; alternatives remain in reference inventory.

## Diagnostic follow-up requiring the operator's local runtime

1. Verify actual Task Scheduler installation/action and `LastTaskResult` for `SamsungSMB-EppAuthKeepAlive-S2`; do not assume installation from XML in repository.
2. Inspect the latest `epp-last-cycle-s2-primary.json` and map each `identities[]` entry to market, programme, status, blocker source and verification timestamps. No passwords, cookies, OTPs or full profile data should be shared.
3. Check programme-specific `playwright/.auth/epp/s2/<market>/...` timestamps without copying secrets. Distinguish stale proof, missing session, security block, external callback and human handoff.
4. Confirm whether each programme is explicitly selected in task environment. Reconcile CO `co_epp_agre` only after the independent EPP CO S2 workstream confirms the supported authentication route; do not overwrite that workstream.
5. For MX `SAMSUNG_ACCOUNT_SECURITY_BLOCKED`, do not automatically retry credentials or bypass security. For CL STALE, inspect the last check and session age before authorizing a safe refresh.
6. Prove a complete guarded live cycle (valid-session reuse and a separately authorized expired-session/CAPTCHA scenario) before asserting that EPP has Base Store-equivalent interactive recovery.

## V4 presentation checks

- Executive summary: Base Store + Human Action stacked, four EPP cards alongside.
- Human Action detail omitted when there are no primary human actions. Blocked does not automatically equal a live CAPTCHA action.
- No word splits in identity/entitlement values. The EPP table labels an idle task as IDLE, not session READY.
- Recent-events controls target their actual `data-event-*-filter` selectors.
- Additional EPP card fields show last check and evidence source. These are diagnostics, not live probing.

Safety: Do not change credentials, account policy, CAPTCHA challenge handling, scheduler installation, session files, payment submits, S1 configuration or Production navigation guards as part of the visual changes.
