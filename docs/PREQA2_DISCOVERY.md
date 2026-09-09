# Samsung WMC PreQA2 discovery

## Confirmed bootstrap behavior

PreQA2 is protected by Samsung WMC authentication. Opening
`https://p6-pre-qa2.samsung.com/sites/` without the legitimate WMC session redirects to the AEM sign-in page and displays `Please login through WMC`.

The approved sequence is:

1. Samsung WMC → **Samsung Employees** → **AD SSO Login**.
2. WMC **QA** → **Preqa2**.
3. In the same authenticated browser context, open `/getcookies`.
4. In that same context, open the required market route: `/mx/`, `/cl/`, `/co/`, or `/pe/`.

No credentials, cookies, tokens, or storage state are persisted by the repository helper. `utils/preqa2Bootstrap.js` validates the exact PreQA2 host and fails closed when the WMC gate is present.

`npm run preqa2:bootstrap` launches real Chrome with the Git-ignored persistent profile `playwright/profiles/preqa2-smb`. It first reuses a valid WMC session when one exists. Otherwise it opens Samsung Employees AD SSO and detects Samsung SSO/SingleID; MFA selection and approval remain manual. The process stays alive for up to two hours by default, detects the authenticated WMC return, opens the approved Preqa2 target, and performs `/sites/` → `/getcookies` → the requested market route automatically.

For a one-time corporate sign-in, `WMC_SSO_EMAIL` and `WMC_SSO_PASSWORD` may be supplied only in the runtime process. The bootstrap removes both entries from `process.env` after reading them, submits the SSO form at most once, never logs their values, and never writes them to disk. SingleID option selection and biometric approval are always manual.

For repeatable local-only execution, the same keys may be stored in `.env.preqa2.local`. The repository ignores every `.env*.local` file. This file must remain workstation-only and must never be attached to evidence, documentation, commits, or CI artifacts.

Diagnostics contain only origin/path identities; SSO/MFA query strings are never written. Discovery output remains below the Git-ignored `test-results/preqa2/` directory. The profile persists browser-managed session state locally but is never versioned or exported as evidence.

## Discovery status — 2026-09-09

The controlled browser did not share the user's existing WMC session. The live request reached the official AEM gate, so storefront DOM discovery could not safely proceed in this run.

| Market | Route | Status |
|---|---|---|
| MX | `/mx/` | Not opened after bootstrap; WMC session required |
| CL | `/cl/` | Not opened after bootstrap; WMC session required |
| CO | `/co/` | Not opened after bootstrap; WMC session required |
| PE | `/pe/` | Not opened after bootstrap; WMC session required |

## Official MX candidates

No coverage classification changed. The following remain candidates for authenticated DOM discovery:

- `SAM-24964` — GNB menu: Missing.
- `SAM-24968` — Base Store PLP facets/filter: Missing.
- `SAM-25001` — Base Store Back to Top: Missing.
- `SAM-25016` — mobile sticky checkout: Missing.
- `SAM-25020` — EPP facets/filter: Missing; requires a real EPP context.
- `SAM-24971` — Cart page UI: Partial.
- `SAM-24989` — Order Summary: Partial.

Selectors and new executable QST cases must only be added after observing the authenticated PreQA2 DOM and comparing the result with each official Expected Result. A route existing is not evidence that its market or EPP context works.

## Next safe execution

```bash
npm run preqa2:bootstrap
```

For a controlled multi-market discovery after MX is proven:

```bash
PREQA2_MARKETS=mx,cl,co npm run preqa2:bootstrap
```

The helper invokes `bootstrapPreqa2Market(page, { environment: { PREQA2_MARKET: "mx" } })` in the existing authenticated context. Do not use the Base Store route as evidence for EPP cases.
