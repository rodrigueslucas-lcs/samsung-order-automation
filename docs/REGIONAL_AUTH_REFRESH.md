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

All commands default to S2; set `AUTH_REFRESH_ENVIRONMENT=S1` for S1. The SECOND shortcuts keep manual identity selection and never reuse PRIMARY credentials. CAPTCHA/MFA remains manual.

Publishing requires all three `JENKINS_URL`, `JENKINS_USER` and `JENKINS_API_TOKEN` environment variables together, or the existing ignored `playwright/.auth/jenkins-publisher.local.json` with `url`, `user`, and `apiToken`. The orchestrator checks this configuration before opening browsers. Explicit environment configuration is never mixed with saved credentials.

Visible email/password fields are populated once when automatic login is configured, even if a CAPTCHA is visible alongside them. No credentials are entered into MFA forms. Each dedicated native browser closes only after verification, packaging and requested publication succeed. A failed or human-gated flow preserves its window for recovery. Shared PreQA2 Chrome is never closed by this cleanup.
