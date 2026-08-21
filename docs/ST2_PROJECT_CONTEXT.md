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
- Search autocomplete can link to an ST2 PDP, while submitting the search navigates to production search results.

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

## Authentication foundation

- Anonymous Home Login uses a JavaScript-triggered OAuth navigation to `account.samsung.com/iam/oauth2/authorize`. The request contains `redirect_uri=https://stg2.shop.samsung.com/pe/login/authorize` and locale `es-PE`; this external navigation is expected.
- The Samsung Account login page exposes textbox `Dirección de correo electrónico`, checkbox `Recordar mi ID`, button `Siguiente`, button `Iniciar sesión con Google`, QR login and a reCAPTCHA iframe. Google can invoke native Chrome FedCM, and MFA/approval/SMS may be required.
- Anonymous Register navigates through `https://account.samsung.com/iam/sign-up` and currently settles on `/iam/sign-up/terms`.
- Use `npm run auth:bootstrap` for a human-assisted login in a dedicated Chrome profile. It completes cookie setup and opens ST2 Home; the user clicks My Profile → Login and completes Samsung Account/FedCM/MFA. The script waits for the callback, verifies `Cerrar sesión`, then writes `playwright/.auth/user.json` with cookies, local storage and IndexedDB.
- `playwright/.auth/`, `playwright/profiles/` and `.env` must remain ignored. Never store Samsung/Google credentials, MFA, SMS codes, cookies or tokens in fixtures or Git.
- Authenticated specs should call `requireAuthState()` and configure `test.use({ storageState: AUTH_STATE_PATH })`, then call `validateAuthenticatedSession(page)` before business actions. Missing setup cookies, missing `Cerrar sesión` or a redirect back to Samsung Account mean the state must be regenerated manually.
- Playwright storage state preserves cookies and local storage, plus IndexedDB when requested; it does not preserve session storage. The bootstrap exports the complete browser-context state, including any Samsung Account and final ST2 cookies, so treat the file as a secret even though no password/OTP is stored in it.
- Whether the final storefront session is fully reusable without session storage is not yet proven. The dedicated persistent profile supports the human FedCM flow; do not run two bootstrap processes against the same profile because Chrome locks `userDataDir`.
- Reuse of the generated state remains structurally prepared but unproven until a dedicated QA account completes the bootstrap. Do not mark authenticated TCs Automated before that execution succeeds.
- Anonymous menu destinations observed on 2026-08-21: `Mis pedidos` → `shop.samsung.com/pe/mypage/orders/`; `Mis productos`, Samsung Rewards and subscriptions lead to `www.samsung.com` production content. Validate those destinations and stop unless an authenticated TC explicitly requires them.
- Automated Login/Register clicks were not retained: the Angular CDK profile overlay is replaced during dynamic loading and intercepted both isolated tests. The same links worked in direct inspection after the menu animation, but not reliably enough for committed coverage. Keep TC6 Blocked and use the manual menu click in the auth bootstrap.

## Additional product data

- ST2 search autocomplete returned Galaxy S25 FE (`SM-S731BLBLLTP`) and Galaxy S25 Ultra (`SM-S938BZKLLTP`) as related products on 2026-08-21.
- The S25 Ultra PDP loaded but was sold out and exposed no visible Trade-in, Samsung Care+, Additional Services or recommendation block, so it is not current mass for TC19 or TC23–TC27.
- The S25 FE PDP was not viable: its ProductPage CMS request returned HTTP 400 and the main content remained empty. Do not retry these two SKUs as service/Trade-in candidates until their ST2 data changes.

## External services

- The Cart service entry is visually associated with Samsung Care+ and currently has the accessible name `Añadir Servicios Adicionales`.
- Locate the CTA by its exact accessible name inside `main`; older executions exposed `Añadir Insurance`.
- On 2026-08-21, the external-service request for `RB45DG6300B1PE` returned HTTP 400 and the modal could not complete loading. This is an ST2 environment/backend block and must not be hidden by an automation fallback.
- The same Cart load also exposed a Trade-in API 404 for the primary SKU; this does not prove that Trade-in is globally unavailable.
- TC28 and TC29 remain Automated because their implementations were successfully validated previously. Record the current HTTP 400 as an execution-environment limitation, separately from coverage status.
- TC19 remains Pending: the current Cart has no recommended-product block, and no service can be added while the External Services endpoint is unavailable.

## DOM characteristics

- PDP can render duplicate product headings and Add to Cart buttons due to sticky components. Scope to `main` and the relevant section.
- Profile menu contains hidden/duplicated Login and Register elements. Scope locators to the visible role `menu` or active overlay.
- The anonymous Profile menu is data-dependent in ST2. On 2026-08-21, `Mis pedidos` appeared in one automated run and was absent in two immediate repeats, while Login/Register remained available. TC6 must remain Blocked until this menu data is stable.
- Cart coupon application is asynchronous. Wait for the processing message to disappear before checking the final total.
- Cart → Guest Login can intermittently remain on Cart with a disabled `Continuar` spinner and disabled product controls. A 2026-08-21 regression reproduced this once in TC37, while TC33 and the isolated TC37 rerun passed. Surface the timeout as ST2 instability; do not bypass it with direct Guest Login navigation.

## Test classification rules

- Supplementary checks do not increase the official 83-TC count.
- TC83 requires an actual mobile order journey; responsive smoke alone is supplementary.
- Authentication-entry contract coverage is Partial until successful login is automated with an approved reusable QA session.
- Keep automation coverage and current environment health distinct: a previously proven test can remain Automated while its Notes record a present ST2 dependency failure.
