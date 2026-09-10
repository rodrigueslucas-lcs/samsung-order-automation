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

`npm run preqa2:bootstrap` launches real Chrome with the Git-ignored persistent profile `playwright/profiles/preqa2-smb`. For a user-visible Chrome started with that same profile and a local debugging port, set `PREQA2_CDP_URL`; the bootstrap attaches to its existing context instead of creating another browser. It first reuses a valid WMC session when one exists. Otherwise it opens Samsung Employees AD SSO and detects Samsung SSO/SingleID; MFA selection and approval remain manual. The process stays alive for up to two hours by default, detects the authenticated WMC return, opens the approved Preqa2 target, and performs `/sites/` → `/getcookies` → the requested market route automatically.

For a one-time corporate sign-in, `WMC_SSO_EMAIL` and `WMC_SSO_PASSWORD` may be supplied only in the runtime process. The bootstrap removes both entries from `process.env` after reading them, submits the SSO form at most once, never logs their values, and never writes them to disk. SingleID option selection and biometric approval are always manual.

For repeatable local-only execution, the same keys may be stored in `.env.preqa2.local`. The repository ignores every `.env*.local` file. This file must remain workstation-only and must never be attached to evidence, documentation, commits, or CI artifacts.

Diagnostics contain only origin/path identities; SSO/MFA query strings are never written. Discovery output remains below the Git-ignored `test-results/preqa2/` directory. The profile persists browser-managed session state locally but is never versioned or exported as evidence.

## Runtime proof — 2026-09-09

The complete flow passed in a user-visible Chrome through local CDP while retaining one persistent browser context:

1. WMC opened **Samsung Employees / AD SSO**.
2. Samsung SSO accepted runtime-only credentials.
3. SingleID displayed **SingleID Authenticator - Bio**; the user selected it and approved MFA on the enrolled phone.
4. The same browser returned to authenticated WMC.
5. WMC opened **QA / Preqa2**.
6. The bootstrap completed `/sites/` → `/getcookies` → `/mx/`.
7. MX rendered at `https://p6-pre-qa2.samsung.com/mx/`, and the ignored `discovery.json` was written.

This proves the complete bootstrap in the current session. It does not yet prove that WMC authentication will remain reusable after expiry, revocation, browser restart, or a later execution.

## Safe MX storefront discovery — 2026-09-09

| Market | Route | Status |
|---|---|---|
| MX | `/mx/` | Opened successfully after the full WMC bootstrap |
| CL | `/cl/` | Opened through the approved bootstrap; navigation landmark observed, but no official TC executed |
| CO | `/co/` | Opened through the approved bootstrap; navigation landmark observed, but no official TC executed |
| PE | `/pe/` | Opened through the approved bootstrap; navigation landmark observed, but no official TC executed |

Observed MX evidence, without cart or account mutation:

- Home exposes a semantic `banner`, `navigation` labelled `main navigation`, and footer content. The current `HomePage` constructor can reuse this target through configured `setupUrl`, `homeUrl`, and footer heading pattern; its PE defaults must not be used implicitly.
- The linked smartphones category page opened at `/mx/smartphones/all-smartphones/`. After the PLP completed its delayed render, the real `Gama de productos` facet exposed a `Galaxy Z` checkbox. The checkbox became selected, but the visible result count remained `43 Resultado`; no changed product set was proven. `SAM-24968` therefore failed authoritative PreQA2 validation and remains Missing in automation coverage.

The registered campaign established the callback pattern used by the current environment. Samsung Account sign-in first returned to the commerce callback page; opening a new `https://p6-pre-qa2.samsung.com/mx/` tab in the same authenticated persistent Chrome context then rendered the Samsung Account user. The Home account menu exposed the user name, `Mi cuenta`, `Mis pedidos`, `Wish List`, `Mis productos`, `Mis Cupones`, `Mis Rewards`, `Mis Suscripciones`, and `Cerrar sesión`. `Mi cuenta` opened `/mx/mypage/` on PreQA2 and rendered the account dashboard plus navigation for products, rewards, orders, wishlist, coupons, repairs, and subscriptions. This is authoritative PASS evidence for `SAM-24962` and `SAM-24963`; WMC authentication alone is still not accepted as storefront-account evidence.

Read-only route discovery in that authenticated context found `/mx/mypage/`, `/mx/mypage/myproducts/`, and `/mx/mypage/rewards/` available on PreQA2. PreQA2-local Orders, Wishlist, and Subscriptions routes returned HTTP 404. My Orders and every Cart/Checkout/Payment/Order scenario are intentionally validated in Staging, where orders and commerce state exist; they are not applicable to the PreQA2 campaign and the PreQA 404 is not an official TC failure. The vouchers menu target attempted to leave PreQA2 for the Production commerce host, so automation must reject that navigation.
- A PDP discovered from that page opened at `/mx/smartphones/galaxy-z-flip6/buy/`. It exposes semantic headings for `Dispositivo`, `Almacenamiento`, `Color`, and `Galaxy Canje`; visible labels included the `256GB | 12GB` and `512GB | 12GB` variants. No add-to-cart action was executed.
- Before Samsung Account authentication, the storefront account control rendered `Manage Account` / `Iniciar Sesión/Registrarme`. After the validated callback/new-tab sequence, it rendered the authenticated user menu and `Cerrar sesión`. WMC authentication protects PreQA content access but remains separate from Samsung Account authentication.

The S1 MX `mxConfig.js` hard guard remains intentionally scoped to `stg.shop.samsung.com`; it must not be weakened for PreQA2. Generic Page Objects that already accept target URLs can be reused, while S1 MX cart, checkout, auth-state, and order helpers remain environment-specific until equivalent PreQA2 behavior is observed safely.

## Official MX candidates

No coverage classification changed. The following remain candidates for authenticated DOM discovery:

- `SAM-24964` — GNB menu: PASS in authoritative PreQA2; implemented by the CDP live-validation runner.
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
