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

## Known Place Order blocker

- The credit-card automation is proven through the `Place Order` submission action. After submission, ST2 can fail because of the known backend/siteId transaction defect.
- Keep TC58 Blocked by the application until developers confirm the environment fix. This is distinct from an automation failure.
- Do not change locators, waits or checkout flow to mask this response, and do not submit `Place Order` repeatedly looking for a different result.
- Preserve failure evidence when the defect occurs. Reinvestigate the completion step only after there is evidence that the ST2 fix was deployed.
- Authenticated pre-submit checks for TC78 (`Banca por Internet`) and TC79 (`Pago Efectivo`) passed on 2026-08-24 by reusing TC39 through Payment and validating the selected accordion with `aria-expanded=true`. Both remain Partial because no Place Order was executed. A focused sequence later expired before the third test preflight; treat that as auth expiration, not a payment-mode failure.
- Authenticated pre-submit checks for TC80 (`Cuotéalo`) and TC77 (credit/debit card) also passed on 2026-08-24. Cuotéalo expanded and rendered non-empty controlled-panel content. TC77 reused `selectCreditCard()`, `fillCardData(testData.card)` and installments, verified all required Mercado Pago fields plus cardholder data, and confirmed `Realizar pedido` was enabled without clicking it. Both remain Partial until an approved order succeeds after the backend fix.

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
- Authenticated specs should call `requireAuthState()`, configure `test.use({ storageState: AUTH_STATE_PATH })`, call `applyAuthSessionStorage(context)` before creating the first page, and then call `validateAuthenticatedSession(page)` before business actions. Missing setup cookies, missing `Cerrar sesión` or a redirect back to Samsung Account mean the state must be regenerated manually.
- Playwright storage state preserves cookies and local storage, plus IndexedDB when requested; it does not preserve session storage. The exporter keeps ST2 host cookies plus cookies set exactly on the shared `.samsung.com` parent domain because those are sent to the storefront; Google, `.account.samsung.com` subdomain and third-party state are excluded. Still treat the exported files as secrets because they contain a live storefront session.
- The observed ST2 state includes persistent and session-only cookies plus Session Storage, and a clean profile reopen displayed a signed-out menu. Playwright `storageState` does not include Session Storage, so export writes both `playwright/.auth/user.json` and `playwright/.auth/session-storage.json`; authenticated contexts must load the storage state and call `applyAuthSessionStorage(context)` before creating their first page. Both files are ignored secrets with mode `0600`.
- The boundary is deliberate: trusted normal Chrome performs the human login, and Playwright attaches only afterward to validate and export the established ST2 session. CDP binds to loopback on an ephemeral port and exists only for the lifetime of the dedicated Chrome process.
- Reuse was proven on 2026-08-21 with `npm run auth:verify`: a fresh Chrome context loaded the exported cookies plus ST2 Session Storage and validated `Cerrar sesión`. This proves reusable Storefront authentication, but it does not automate the human Google/Samsung login itself.
- In the reusable context, `/users/current` and `/users/current/checkAccess` returned HTTP 200 and `checkAccess.canAccess=true`. Even so, the authenticated menu rendered only the user header and Logout; `Mis pedidos` was absent in both the reusable context and a final check of the live human session. Keep TC12 Blocked until the menu/data is available and an existing order can be verified. Do not navigate directly to the known production orders URL to bypass the missing entry.
- Authenticated address inspection on 2026-08-21 found no safe Profile route. A fresh-auth recheck on 2026-08-24 produced the same result: the leaf menu exposed only `[role=menuitem][data-an-la="user name"]` and Logout, and one normal click on the user item timed out without navigation. TC40 therefore remains Pending and no QA address was persisted without a safe Profile readback/cleanup path. Keep TC7 and TC8 Blocked until the current ST2 Profile/address entry point renders and works reliably; do not navigate directly to an inferred account route or modify pre-existing account data.
- Authenticated Cart → Checkout correctly bypasses Guest Login and reaches `CHECKOUT_STEP_CONTACT_INFO`. First and last name are populated, while phone and document may need the existing test data. Manual validation subsequently proved that `CHECKOUT_STEP_DELIVERY` renders Dirección de entrega, Departamento/Provincia/Distrito, address fields and `Guardar datos de envío en Mi cuenta`. The earlier Playwright non-render must be treated as synchronization/intermittency, not an ST2 blocker. TC39 and TC40 remain Pending until isolated automation passes; no address was saved, edited or deleted during the initial inspection.
- Before any authenticated Cart/Checkout attempt, validate `Cerrar sesión` in the same context, then require SKU `RB45DG6300B1PE` in Cart. A 2026-08-21 run proved that the empty anonymous Cart was caused by an expired saved auth snapshot: the preflight failed before add-to-cart and `npm run auth:verify` independently reported the same expiration. Stop there and refresh auth from a live authenticated QA Chrome; do not retry Cart or classify Delivery as blocked.
- The reusable auth snapshot has a limited lifetime (observed at roughly one hour). A renewed snapshot passed `auth:verify` and authenticated Checkout reached the real Delivery form, but later expired during a subsequent preflight; the run stopped before add-to-cart as designed. Always run the authenticated preflight immediately before these flows, and treat a Playwright synchronization failure separately from an ST2 application blocker.
- Authenticated new-address checkout passed through Payment on 2026-08-21 without saving or modifying account data. The authenticated-specific setup handles reusable auth, skips Guest Login, selects `Nueva dirección`, and leaves `Guardar datos de envío en Mi cuenta` unchecked. From the completed address onward it must reuse the proven guest baseline unchanged: `fillAddress()`, `selectShippingMethod()`, `acceptTerms()`, and `continueToPayment()`. Experimental authenticated-only shipping synchronization diverged from this functional sequence and was removed. TC39/TC40 remain Pending because this safe smoke neither saved an address nor verified it in Profile.
- TC39 passed on 2026-08-24 with a renewed reusable auth state. The test selected `Dirección guardada`, required a real saved-address radio to be checked, reused `selectShippingMethod()`, `acceptTerms()` and `continueToPayment()`, and stopped at Payment. It did not edit the saved address or execute Place Order. TC40 remains Pending because creating a new saved address and verifying it through the Profile UI are separate persistent-data requirements.
- Anonymous menu destinations observed on 2026-08-21: `Mis pedidos` → `shop.samsung.com/pe/mypage/orders/`; `Mis productos`, Samsung Rewards and subscriptions lead to `www.samsung.com` production content. Validate those destinations and stop unless an authenticated TC explicitly requires them.
- Automated Login/Register clicks were not retained: the Angular CDK profile overlay is replaced during dynamic loading and intercepted both isolated tests. The same links worked in direct inspection after the menu animation, but not reliably enough for committed coverage. Keep TC6 Blocked and use the manual menu click in normal Chrome.

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
- TC19 remains Pending: the current Cart has no recommended-product block, and no service can be added while the External Services endpoint is unavailable.

## DOM characteristics

- PDP can render duplicate product headings and Add to Cart buttons due to sticky components. Scope to `main` and the relevant section.
- Profile menu contains hidden/duplicated Login and Register elements. Scope locators to the visible role `menu` or active overlay.
- The anonymous Profile menu is data-dependent in ST2. On 2026-08-21, `Mis pedidos` appeared in one automated run and was absent in two immediate repeats, while Login/Register remained available. TC6 must remain Blocked until this menu data is stable.
- On 2026-08-24, the Home footer exposed visible text `Pedidos` as an `<a target="_blank">` without an `href`; navigation is JavaScript-controlled. Do not infer or hardcode a tracking route for TC13. Validate the popup destination from a real click only when disposable guest order data is available.
- The reusable authenticated snapshot was expired during the 2026-08-24 Pending audit. Auth-dependent TC39/TC40 work was intentionally skipped; this is session expiration, not a Storefront regression or a reason to change coverage.
- Cart coupon application is asynchronous. Wait for the processing message to disappear before checking the final total.
- Cart → Guest Login can intermittently remain on Cart with a disabled `Continuar` spinner and disabled product controls. A 2026-08-21 regression reproduced this once in TC37, while TC33 and the isolated TC37 rerun passed. Surface the timeout as ST2 instability; do not bypass it with direct Guest Login navigation.

## Test classification rules

- Supplementary checks do not increase the official 83-TC count.
- TC83 requires an actual mobile order journey; responsive smoke alone is supplementary.
- Authentication-entry contract coverage is Partial until successful login is automated with an approved reusable QA session.
- Keep automation coverage and current environment health distinct: a previously proven test can remain Automated while its Notes record a present ST2 dependency failure.
