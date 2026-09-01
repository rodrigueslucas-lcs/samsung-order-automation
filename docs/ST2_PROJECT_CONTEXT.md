# ST2 Peru Automation Context

## Scope

This repository automates the Samsung Peru ST2 storefront with Playwright. BackOffice, cronjobs and fulfillment workflows are separate concerns and must not be inferred from storefront behavior.

## Required ST2 setup

1. Open `https://stg2.shop.samsung.com/getcookie.html`.
2. Wait for `You can access pages now!`.
3. Use the existing product add-to-cart setup.
4. Enter checkout through Cart. Do not navigate directly to Checkout or Payment.

The primary SKU is `RB45DG6300B1PE`.

The add-to-cart endpoint response is sufficient to continue to Cart; wait for SKU `RB45DG6300B1PE` to become visible there instead of using a fixed delay. From Cart, click `Continuar` and wait for the guest email input. Do not fall back to direct Guest Login navigation when the click does not advance.

## Navigation boundaries

- `stg2.shop.samsung.com` is the ST2 business-flow host.
- Header category, support, legal and many footer links intentionally navigate to `www.samsung.com`.
- My Orders can navigate to `shop.samsung.com`.
- Login, registration and anonymous wishlist confirmation navigate to `account.samsung.com`.
- Business actions must stop after leaving the ST2 host unless a test explicitly validates only the external destination.
- Search autocomplete related-product clicks can resolve either to an ST2 PDP or to the matching Samsung Peru production PDP. Validate the Peru host/path and SKU; after a production exit, stop the business flow.

## Checkout and data

- Peru address hierarchy is Departamento → Provincia → Distrito. Distrito represents City for TC45.
- Departamento, Provincia and Distrito are Angular Material comboboxes, not native selects.
- Postal Code is not exposed in the current Delivery or Billing UI.
- Billing address is rendered by `app-billing-address-v2`. Selecting `Deseo factura` reveals company, RUC and a separate Departamento/Provincia/Distrito/address form.
- Delivery and Payment sections render asynchronously. Assertions should wait for their visible headings or controls.

## Payment and Place Order status

- TC58, TC60 and TC62 passed with a single successful credit-card submission and confirmation. Never retry a submit automatically: a timeout is ambiguous and a retry can create a duplicate order.
- TC77-TC80 and TC82 are Automated. The read-only payment checks validate the mode code/semantic accordion and stop before provider submission; provider redirects are an explicit external boundary.
- TC81 is Blocked because the current `paymentmodes` response does not return `pe-yape`. Keep the API observation sanitized to origin/path/status and do not log query strings, tokens or response bodies.
- Alternative-provider submit is a destructive diagnostic. It requires both an approved `STOREFRONT_PAYMENT_MODE` and explicit `ALLOW_PAYMENT_SUBMIT=1`; the helper performs one click and no retry.

## Authentication foundation

- Anonymous Home Login uses a JavaScript-triggered OAuth navigation to `account.samsung.com/iam/oauth2/authorize`. The request contains `redirect_uri=https://stg2.shop.samsung.com/pe/login/authorize` and locale `es-PE`; this external navigation is expected.
- The Samsung Account login page exposes textbox `Dirección de correo electrónico`, checkbox `Recordar mi ID`, button `Siguiente`, button `Iniciar sesión con Google`, QR login and a reCAPTCHA iframe. Google can invoke native Chrome FedCM, and MFA/approval/SMS may be required.
- Anonymous Register navigates through `https://account.samsung.com/iam/sign-up` and currently settles on `/iam/sign-up/terms`.
- TC3 pre-auth passed on 2026-08-24 through the required Product→Cart→Checkout sequence. The real Checkout Login control is the button `Samsung Checkout Express`, not `Iniciar sesión`; clicking it navigates to `account.samsung.com/iam/*`. Keep TC3 Partial because Google/FedCM/MFA and the authenticated callback are intentionally human-only.
- Google currently rejects sign-in inside the Playwright-controlled browser with `Esse navegador ou app pode não ser seguro`. Treat this as an authentication-provider limitation, not an ST2 defect. Do not retry automated Google login, weaken browser security, hide automation or bypass CAPTCHA/MFA.
- Authentication uses two explicit phases. Run `npm run auth:open-profile` to open normal Google Chrome with the dedicated `playwright/profiles/st2-peru-qa` profile. The user completes cookie setup, ST2 Login, Google/FedCM and any CAPTCHA/MFA/SMS manually, confirms `Cerrar sesión` on ST2, keeps that Chrome open, and runs `npm run auth:export` from another terminal.
- The normal Chrome is started with an ephemeral loopback CDP endpoint and background mode disabled. This is an official browser interface used only after human authentication; it does not hide automation or bypass the identity provider. Other processes on the same machine could attach while the endpoint is active, so keep the window short-lived and never reuse the dedicated profile for personal browsing.
- The export phase connects to the already-running dedicated Chrome, completes ST2 cookie setup in a new tab, resolves the visible leaf `role=menu` that contains `Cerrar sesión` and no nested menu, and exports the reusable state. This avoids the outer/inner Angular Material menus that are simultaneously visible. It does not perform or retry login; close Chrome normally after export finishes.
- `playwright/.auth/`, `playwright/profiles/` and `.env` must remain ignored. Never store Samsung/Google credentials, MFA, SMS codes, cookies or tokens in fixtures or Git.
- Authenticated specs should use `hasAuthState()` to configure storage conditionally and skip clearly when state is absent, call `applyAuthSessionStorage(context)` before creating the first page, and then call `validateAuthenticatedSession(page)` before business actions. Missing setup cookies, missing `Cerrar sesión` or a redirect back to Samsung Account mean the state must be regenerated manually.
- Playwright storage state preserves cookies and local storage, plus IndexedDB when requested; it does not preserve session storage. The exporter keeps ST2 host cookies plus cookies set exactly on the shared `.samsung.com` parent domain because those are sent to the storefront; Google, `.account.samsung.com` subdomain and third-party state are excluded. Still treat the exported files as secrets because they contain a live storefront session.
- The observed ST2 state includes persistent and session-only cookies plus Session Storage, and a clean profile reopen displayed a signed-out menu. Playwright `storageState` does not include Session Storage, so export writes both `playwright/.auth/user.json` and `playwright/.auth/session-storage.json`; authenticated contexts must load the storage state and call `applyAuthSessionStorage(context)` before creating their first page. Both files are ignored secrets with mode `0600`.
- The boundary is deliberate: trusted normal Chrome performs the human login, and Playwright attaches only afterward to validate and export the established ST2 session. CDP binds to loopback on an ephemeral port and exists only for the lifetime of the dedicated Chrome process.
- Reuse was proven on 2026-08-21 with `npm run auth:verify`: a fresh Chrome context loaded the exported cookies plus ST2 Session Storage and validated `Cerrar sesión`. This proves reusable Storefront authentication, but it does not automate the human Google/Samsung login itself.
- My Account menu links may point to Production, but their approved paths can be rewritten to `stg2.shop.samsung.com` under an explicit host guard. Direct ST2 Orders and Wishlist render; `/pe/mypage`, My Products, Rewards and Select AI have missing CMS content and no functional main component.
- TC12 is Automated on direct ST2 Orders with existing automated order `PE260826-74796841`. TC7-TC11 are Blocked because Address Management UI is absent; the authenticated address API is healthy but returned zero saved addresses. TC40 is Partial pending a stable integrated save/readback run.
- Before any authenticated Cart/Checkout attempt, validate `Cerrar sesión` in the same context, then require SKU `RB45DG6300B1PE` in Cart. A 2026-08-21 run proved that the empty anonymous Cart was caused by an expired saved auth snapshot: the preflight failed before add-to-cart and `npm run auth:verify` independently reported the same expiration. Stop there and refresh auth from a live authenticated QA Chrome; do not retry Cart or classify Delivery as blocked.
- The reusable auth snapshot has a limited lifetime (observed at roughly one hour). A renewed snapshot passed `auth:verify` and authenticated Checkout reached the real Delivery form, but later expired during a subsequent preflight; the run stopped before add-to-cart as designed. Always run the authenticated preflight immediately before these flows, and treat a Playwright synchronization failure separately from an ST2 application blocker.
- Authenticated new-address checkout can reuse the proven guest Delivery baseline and stop before Place Order. Only `QA AUTOMATION` address data may be mutated and cleanup is mandatory.
- TC39 passed with a renewed reusable auth state. TC40 now has a safe authenticated API readback/cleanup path but remains Partial because the integrated rerun was blocked by the current multi-shipment delivery selection before persistence.
- Anonymous menu destinations observed on 2026-08-21: `Mis pedidos` → `shop.samsung.com/pe/mypage/orders/`; `Mis productos`, Samsung Rewards and subscriptions lead to `www.samsung.com` production content. Validate those destinations and stop unless an authenticated TC explicitly requires them.
- TC6 is Automated: the authenticated hover/menu structure exposes the expected account/order/logout entries without following My Account into Production.

## Additional product data

- ST2 search autocomplete returned Galaxy S25 FE (`SM-S731BLBLLTP`) and Galaxy S25 Ultra (`SM-S938BZKLLTP`) as related products on 2026-08-21.
- The S25 Ultra PDP loaded but was sold out and exposed no visible Trade-in, Samsung Care+, Additional Services or recommendation block, so it is not current mass for TC19 or TC23–TC27.
- The S25 FE PDP was not viable: its ProductPage CMS request returned HTTP 400 and the main content remained empty. Do not retry these two SKUs as service/Trade-in candidates until their ST2 data changes.

## External services

- The Cart service entry is visually associated with Samsung Care+ and currently has the accessible name `Añadir Servicios Adicionales`.
- Locate the CTA by its exact accessible name inside `main`; older executions exposed `Añadir Insurance`.
- On 2026-08-21, the external-service request for `RB45DG6300B1PE` returned HTTP 400. Recent regression evidence confirms the CTA opens the modal, but it remains at `Cargando página...` and its internal journey never renders. This is an ST2 environment/backend block and must not be hidden by an automation fallback.
- The same Cart load also exposed a Trade-in API 404 for the primary SKU; this does not prove that Trade-in is globally unavailable.
- TC28 and TC29 remain Automated because their implementations were successfully validated previously. Record the current HTTP 400 as an execution-environment limitation, separately from coverage status.
- TC19 remains Partial: Additional Services is validated, while the recommended-product block depends on current ST2 catalog data.
- TC59 remains Partial and on stand-by because ST2 removes Samsung Care+ at Checkout as unavailable/out of stock. Its destructive spec is statically skipped until the test mass is corrected.

## DOM characteristics

- PDP can render duplicate product headings and Add to Cart buttons due to sticky components. Scope to `main` and the relevant section.
- Profile menu contains hidden/duplicated Login and Register elements. Scope locators to the visible role `menu` or active overlay.
- Never follow My Account links into Production. Reuse the centralized ST2 URL rewrite/host guard. TC6 remains valid from menu structure; TC12 uses direct ST2 Orders; TC7-TC11 remain skipped with an evidence-backed Address Management blocker.
- Historical anonymous-menu rendering was intermittent, but TC6 is now Automated against the authenticated menu structure and stops before following any Production redirect.
- On 2026-08-25, headed real-Chrome discovery confirmed that the Home footer exposes `Pedidos` as an `<a target="_blank">` without an `href`; navigation is JavaScript-controlled and initially creates a blank popup. Wait for an HTTP(S) URL after the popup event instead of treating its first `domcontentloaded` as the destination.
- The observed guest destination is `https://shop.samsung.com/pe/mypage/orders`. Its form requires `Número de pedido` and `Correo electrónico`, exposes an initially optional `Código de verificación`, `Enviar código`, and a disabled `Buscar` button. Empty-field messages are `Por favor, ingrese un número de pedido válido` and `Por favor, ingrese el correo asociado al pedido`; malformed email retains the email message.
- `Enviar código` calls `POST https://p1-smb-api-cdn.shop.samsung.com/tokocommercewebservices/v2/pe/guest/sendOrderOtp`. Deliberately nonexistent discovery data returned HTTP 401 and left `Buscar` disabled. This is TEMPORARY INVALID TEST DATA only; the definitive TC13 architecture must receive the order number/email from a future automated checkout and complete the emailed OTP before validating the returned order.
- Current Windows/Codex execution diagnosis for `browserContext.close: spawn EPERM`: real Chrome contexts close normally with no recording, and also with Playwright tracing enabled; adding only `recordVideo` reproduces `spawn EPERM`. The Playwright FFmpeg v1011 install location reported by `playwright install --dry-run` is absent from the local browser cache, so the failure is isolated to spawning the video encoder during teardown, not to the functional flow, Chrome channel, profile lock, or a live Chrome child process.
- Video is therefore opt-in with `PW_VIDEO=1`; screenshots and traces remain enabled by default. Re-enable video only after the matching Playwright FFmpeg is installed and allowed by corporate policy.
- The reusable authenticated snapshot was expired during the 2026-08-24 Pending audit. Auth-dependent TC39/TC40 work was intentionally skipped; this is session expiration, not a Storefront regression or a reason to change coverage.
- Cart coupon application is asynchronous. Wait for the processing message to disappear before checking the final total.
- Cart → Guest Login can intermittently remain on Cart with a disabled `Continuar` spinner and disabled product controls. A 2026-08-21 regression reproduced this once in TC37, while TC33 and the isolated TC37 rerun passed. Surface the timeout as ST2 instability; do not bypass it with direct Guest Login navigation.

## Test classification rules

- Supplementary checks do not increase the official 83-TC count.
- TC83 requires an actual mobile order journey; responsive smoke alone is supplementary.
- Authentication-entry contract coverage is Partial until successful login is automated with an approved reusable QA session.
- Keep automation coverage and current environment health distinct: a previously proven test can remain Automated while its Notes record a present ST2 dependency failure.

## Safe execution commands

- Non-destructive smoke: `npx playwright test tests/s2/pe/dst/base-store/home/home.spec.js tests/s2/pe/dst/base-store/mobile/mobile.spec.js --project=chromium --workers=1 --headed`
- Cart: `npx playwright test tests/s2/pe/dst/base-store/cart --project=chromium --workers=1 --headed`
- Checkout pre-submit: `npx playwright test tests/st2/base-store/checkout/checkout.spec.js --project=chromium --workers=1 --headed`
- Payment read-only: `npx playwright test tests/st2/base-store/payment/payment.spec.js --project=chromium --grep-invert "@destructive" --workers=1 --headed`
- Mobile read-only: `npx playwright test tests/s2/pe/dst/base-store/mobile/mobile.spec.js --project=chromium --workers=1 --headed`
- Full safe storefront regression: run the smoke, Cart, Checkout pre-submit, Payment read-only, PDP and Search groups explicitly; do not include order, auth, tracking-to-Production, provider-submit or BackOffice write specs.
- Authenticated block after renewal: `npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --workers=1 --headed`
- TC12 with existing order: run the read-only authenticated profile spec against direct ST2 Orders with `AUTHENTICATED_ORDER_CODE=PE260826-74796841`; never follow the Production menu URL.
- BackOffice read-only: `npx playwright test tests/st2/backoffice/backoffice.spec.js --project=chromium --grep "TC64|TC65|TC66|TC69|TC71" --workers=1 --headed` with runtime credentials and the intended staging environment.
