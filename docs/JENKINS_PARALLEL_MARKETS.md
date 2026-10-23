# Jenkins parallel SMB market lanes

## Goal
Run MX, PE, CO and CL at the same time without sharing a Jenkins workspace, auth artifacts, reports or market-specific runtime state.

## Recommended Jenkins topology
Use four sibling Jenkins jobs that point to the same repository, branch and `Jenkinsfile`:

- `Samsung-SMB-MX`
- `Samsung-SMB-PE`
- `Samsung-SMB-CO`
- `Samsung-SMB-CL`

The existing `disableConcurrentBuilds()` remains useful: it prevents two builds of the same market job from overlapping, while different jobs are still allowed to execute together.

Configure the Windows Jenkins node with at least 4 executors. Jenkins will allocate independent workspaces to the four jobs, so `playwright/.auth`, `test-results`, Playwright output, Allure results/report, local Allure history/cache and Executive Dashboard files remain isolated by job workspace.

## Operator flow
1. Keep one visible Chrome running with CDP on `127.0.0.1:9223` and an authenticated WMC / AD SSO session.
2. Prepare persistent PreQA2 market tabs with:

   ```bash
   PREQA2_CDP_URL="http://127.0.0.1:9223" PREQA2_MARKETS="mx,pe,co,cl" node scripts/preqa2-market-lanes.cjs
   ```

3. Verify the four tabs without navigating or reloading them:

   ```bash
   PREQA2_CDP_URL="http://127.0.0.1:9223" PREQA2_MARKETS="mx,pe,co,cl" node scripts/preqa2-lanes-health.cjs
   ```

   Expected result: `PASS` for MX, PE, CO and CL followed by `READY · 4/4 market lanes healthy`.

4. Refresh/package/publish the session required by MX and start `Samsung-SMB-MX`.
5. While MX runs, refresh/package/publish PE and start `Samsung-SMB-PE`.
6. Repeat for CO and CL.
7. The four jobs may now run simultaneously on four Jenkins executors.

## Shared PreQA2 browser contract
One Chrome / one WMC context may expose one persistent tab per market:

- `SAMSUNG_QA_PREQA2_MX` -> `/mx/`
- `SAMSUNG_QA_PREQA2_PE` -> `/pe/`
- `SAMSUNG_QA_PREQA2_CO` -> `/co/`
- `SAMSUNG_QA_PREQA2_CL` -> `/cl/`

`utils/preqa2MarketLanes.cjs` owns this contract. A market lane must create or reuse only its own tab and must never navigate or close another market's tab.

`preqa2-cdp-preflight.cjs` is market-aware through `PREQA2_MARKET` (or the build `MARKET`). Its validation uses a temporary page and closes only that page. It must never reuse, navigate or close one of the persistent market tabs because another Jenkins build may be using it.

The browser context intentionally shares the legitimate WMC/SSO cookies. Market navigation is isolated by Page/tab. Because all four routes use the same PreQA2 origin, browser-origin storage is technically shared; therefore the four-tab model must be runtime-proven before treating cross-market execution as fully isolated. If a storefront writes a conflicting global market value into localStorage/cookies, fall back to separate Chrome contexts/profiles for that market.

## Jenkins safety boundaries
- Do not remove same-job concurrency protection merely to obtain four-market parallelism. Four sibling jobs provide safer lane-level serialization.
- Do not run two builds of the same market job simultaneously.
- Keep market credentials/bundles distinct (`samsung-mx-*`, `samsung-pe-*`, `samsung-co-*`, `samsung-cl-*`).
- Do not use one job workspace as another job's artifact, auth or history source.
- Keep each official P1 runner at `--workers=1`; the parallelism is at market/build level, not inside a stateful market campaign.
- Shared `PLAYWRIGHT_BROWSERS_PATH` is allowed for installed browser binaries, but installation should be completed before the four-market run rather than by four builds concurrently.

## Agent preparation
The node must have at least 4 Jenkins executors and enough CPU/RAM for approximately four active Playwright browser processes plus Node/report generation.

Playwright browsers should ideally be preinstalled in the shared Jenkins browser cache before the regional run. This avoids four builds attempting a Chromium installation at the same time.

## Validation before production use
1. Open all four PreQA2 lanes and confirm every tab stays on its own market route.
2. Run `scripts/preqa2-lanes-health.cjs` and require 4/4 PASS.
3. Re-run `scripts/preqa2-market-lanes.cjs` and confirm all four report `reused` instead of creating duplicate tabs.
4. Navigate each tab while the others remain open and confirm no market switch occurs in the other tabs.
5. Run one small/targeted TC per market in parallel.
6. Confirm each Jenkins job publishes only its own artifacts, Allure data and history.
7. Run two markets in parallel, then four.
8. Only after this runtime evidence should four full P1 campaigns be considered supported.
