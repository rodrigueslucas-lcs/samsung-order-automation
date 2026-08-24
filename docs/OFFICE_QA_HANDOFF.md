# ST2 Peru Office QA Handoff

## Current baseline

| Metric | Value |
|---|---:|
| Official Base Store TCs | 83 |
| Automated | 32 |
| Partial | 5 |
| Blocked | 5 |
| Not Applicable | 2 |
| Pending | 39 |

Official total: `32 + 5 + 5 + 2 + 39 = 83`. Supplementary tests do not change this count.

## Pending clusters

| Class | Cluster | TCs | Decision |
|---|---|---|---|
| A — simple later | Login entry/destination checks | 1, 2, 3, 5 | Implement only after agreeing whether destination-only validation satisfies the official “login” wording. |
| B — small reuse | Guest tracking entry | 13 | Footer control exists, but destination and disposable order data are missing. |
| B — small reuse | Conditional Cart content | 19 | Existing Cart setup is reusable; current SKU has no recommendation and External Services is unavailable. |
| C — completed | Authenticated saved-address checkout | 39 | Automated on 2026-08-24; validates the selected saved address and reaches Payment using the guest Delivery→Payment methods. |
| D — complex | Profile address lifecycle | 9, 10, 11, 40 | Requires a working Profile address entry point and disposable QA data. Do not modify pre-existing addresses. |
| D — complex | Trade-in / Samsung Care+ journey | 23–27, 30–32 | Requires eligible SKU/service data. Current External Services request returns HTTP 400. |
| E — environment/data | Order completion and confirmation | 59, 60, 62, 63, 77–83 | TC77–TC80 pre-submit behavior is proven, but order completion remains unavailable. Do not mark payment-mode TCs Automated until the known post-Place-Order defect is fixed and required payment/order data is approved. |
| E — out of current scope | BackOffice / fulfillment | 64–76 | Requires separate environment, roles and workflow. |

## Recommended implementation queue

The entries below are ordered by implementation effort, but each dependency must be satisfied before coding or execution.

| TC | Description | Priority | Spec | Page Object | Existing code to reuse | Missing implementation | Fixture | Locator / strategy | Steps | Final assertion | Isolated command |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Verify Tracking Order Page (includes Guest) | 1 | `tests/st2/base-store/home/tracking.spec.js` | `HomePage` | `openHome()` | `openGuestOrders()` that waits for popup and validates its observed destination | Disposable guest order number/email; do not use personal order data | Scope `getByRole('contentinfo')`; visible exact text `Pedidos`. The live element is `<a target="_blank">` with no `href`, so use `context.waitForEvent('page')` and validate the resulting URL | Cookie setup → Home → footer → click Pedidos → capture popup → stop | Allowed Samsung Peru orders/tracking host and tracking UI visible; no submission without approved disposable data | `npx playwright test tests/st2/base-store/home/tracking.spec.js --project=chromium --workers=1` |
| 19 | Added services / recommended products, if data exists | 2 | `tests/st2/base-store/cart/cart.spec.js` | `ProductPage`, `CartPage` | `validateProductLoaded()`, `addToCart()`, `validateProductInCart()`, `validateExternalServicesVisible()` | Conditional `validateRecommendedProductsOrAddedServices()` returning explicit availability evidence | SKU eligible for recommendations or successfully added service | Scope to `main`; use accessible service/product heading and SKU link, not broad card CSS | Setup → add SKU → Cart → inspect recommendation/service section | Recommended SKU or added service visible in Cart and summary | `npx playwright test tests/st2/base-store/cart/cart.spec.js --project=chromium --grep "TC19" --workers=1` |
| 23 | Click Trade-in button | 3 | `tests/st2/base-store/cart/trade-in.spec.js` | `ProductPage`, `CartPage` | Standard Product→Cart setup | `getTradeInButton()` and `openTradeIn()` | Trade-in-eligible ST2 SKU | Exact accessible CTA inside `main`; discover from eligible SKU, never guess from Samsung Care+ | Setup → add eligible SKU → Cart → verify CTA → click once | Trade-in modal heading visible | `npx playwright test tests/st2/base-store/cart/trade-in.spec.js --project=chromium --grep "TC23" --workers=1` |
| 24 | Navigate Trade-in popup journey | 4 | `tests/st2/base-store/cart/trade-in.spec.js` | `CartPage` | TC23 setup/open method | Semantic modal step helper using headings/radios/buttons | Same eligible SKU and journey answers approved for QA | Scope every locator to active dialog/overlay; use role `dialog`, headings, labels and enabled Next button | Reuse TC23 → traverse non-destructive steps → stop before adding | Expected final review/amount step visible | `npx playwright test tests/st2/base-store/cart/trade-in.spec.js --project=chromium --grep "TC24" --workers=1` |
| 30 | Add Samsung Care+ in Cart | 6 | `tests/st2/base-store/cart/cart.spec.js` | `CartPage` | `getAdditionalServicesButton()`, `validateSamsungCareJourney()` | Select eligible radio and confirm add action after service endpoint recovers | Current primary SKU if service API is fixed | Active service dialog; exact Samsung Care+ radio accessible name and semantic Add/Continue button | Setup → Cart → open Additional Services → choose plan → add | Modal closes and chosen Samsung Care+ line appears in Cart | `npx playwright test tests/st2/base-store/cart/cart.spec.js --project=chromium --grep "TC30" --workers=1` |
| 31 | Show Samsung Care+ amount in summary | 7 | `tests/st2/base-store/cart/cart.spec.js` | `CartPage` | TC30 helper, `validateOrderSummary()` | Capture service price and validate matching summary line/total | Same as TC30 | Scope service line and summary by accessible text; parse `S/` values, do not assert hardcoded price | Reuse TC30 → read service amount → inspect summary | Service amount visible and total reflects service | `npx playwright test tests/st2/base-store/cart/cart.spec.js --project=chromium --grep "TC31" --workers=1` |
| 40 | Save checkout address and verify in Profile | 8 | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | `CheckoutPage`, future `ProfilePage` | Authenticated new-address smoke through Delivery; `fillAddress()`, `validateAddressValues()` | Opt-in save helper plus Profile navigation/readback; cleanup only the address created by the test | Unique disposable QA address with recognizable suffix | Delivery checkbox `Guardar datos de envío en Mi cuenta`; Profile locators must be discovered from a working entry point before implementation | Fresh auth → Nueva dirección → QA address → check save → advance without Place Order → Profile → verify exact address | Unique QA address visible in Profile; preserve all pre-existing addresses | `npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --grep "TC40" --workers=1` |
| 77 | Credit-card order mode | 9 | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | `PaymentPage` | `selectCreditCard()`, `fillCardData(testData.card)`, `validateCreditCardReady()` | Only the final approved Place Order/confirmation remains after the backend fix | Existing Mercado Pago sandbox `testData.card` only | Existing Mercado Pago iframe locators and enabled `Realizar pedido`; never hardcode card data in spec/Page Object | Auth TC39 baseline → Payment → card fields/installments → readiness assertion → stop | Pre-submit already proven; confirmation/order number required for Automated | `npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --grep "TC77 pre-submit" --workers=1` |
| 80 | Cuotéalo order mode | 10 | `tests/st2/base-store/checkout/authenticated-checkout.spec.js` | `PaymentPage` | `selectPaymentMode()`, `selectCuotealo()` | Only provider-specific completion and approved Place Order remain | No new fixture for current pre-submit check | Button `/^Cuotéalo\b/i`; assert `aria-expanded=true`, resolve `aria-controls`, require visible non-empty panel | Auth TC39 baseline → Payment → Cuotéalo → validate panel → stop | Pre-submit already proven; confirmation required for Automated | `npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --grep "TC80 pre-submit" --workers=1` |
| 83 | Place order on mobile | 10 | `tests/st2/base-store/mobile/mobile-order.spec.js` | Existing guest Page Objects; extend only where responsive semantics differ | Entire guest checkout baseline plus mobile viewport from `mobile.spec.js` | Mobile-specific navigation assertions and final approved order execution | Existing guest fixtures and sandbox card; backend must be fixed | Reuse accessible locators at `390x844`; inspect responsive overlays only when a baseline locator fails | Mobile viewport → required setup → guest Cart/Checkout/Payment → one Place Order click | Mobile order confirmation and order number | `npx playwright test tests/st2/base-store/mobile/mobile-order.spec.js --project=chromium --workers=1` |

## Local authentication prerequisite

`playwright/.auth/*` is intentionally not versioned. Each machine must create its own local reusable state. Never copy auth files through Git, chat or shared storage.

```bash
npm run auth:open-profile
```

Complete Samsung/Google login manually in the dedicated QA Chrome and keep it open. In another terminal:

```bash
npm run auth:export
npm run auth:verify
```

Run authenticated tests only after `auth:verify` passes.

## Commands for the Samsung machine

```bash
git pull --ff-only origin main
npx playwright test --list
npx playwright test --project=chromium --workers=1
npx playwright test tests/st2/base-store/smoke/guest-checkout.spec.js --project=chromium --workers=1
npx playwright test tests/st2/base-store/cart --project=chromium --workers=1
npx playwright test tests/st2/base-store/checkout/checkout.spec.js --project=chromium --workers=1
npx playwright test tests/st2/base-store/payment --project=chromium --workers=1
npx playwright test tests/st2/base-store/search/search.spec.js --project=chromium --workers=1
npx playwright test tests/st2/base-store/mobile/mobile.spec.js --project=chromium --workers=1
npm run auth:verify
npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --workers=1
```

## Five copy/paste-ready office tasks

| TC | Reuse | Minimal change | Isolated command | Gate before implementation |
|---:|---|---|---|---|
| 1 | `HomePage.openHome()` and authenticated session helpers | Add `tests/st2/base-store/home/login.spec.js`; validate `Cerrar sesión` from Home using local auth state | `npx playwright test tests/st2/base-store/home/login.spec.js --project=chromium --grep "TC1" --workers=1` | Confirm reusable-session validation satisfies the official “login” wording; do not automate Google/FedCM |
| 2 | `HomePage.openHome()` and the semantic Profile menu pattern from `authState.js` | Add a shop-menu entry assertion before validating the authenticated state | `npx playwright test tests/st2/base-store/home/login.spec.js --project=chromium --grep "TC2" --workers=1` | Confirm exact Confluence meaning of “via shop menu” |
| 3 | `ProductPage`, `CartPage.proceedToCheckout()` and authenticated helpers | Add a checkout-login entry test that proves the Login control/destination, then restores auth only through the approved fixture architecture | `npx playwright test tests/st2/base-store/checkout/login.spec.js --project=chromium --grep "TC3" --workers=1` | Do not automate Google/FedCM; agree whether destination-only coverage is Partial |
| 5 | Existing Product→Cart and Checkout Login flow | Reuse TC33 setup, assert Cart SKU, enter Checkout and validate registered-login entry | `npx playwright test tests/st2/base-store/checkout/login.spec.js --project=chromium --grep "TC5" --workers=1` | Official wording is ambiguous (“place order until Cart”); confirm expected stopping point |
| 81 | `reachAuthenticatedPaymentWithSavedAddress()` and `PaymentPage.selectPaymentMode()` | Add `selectYape()` only if a semantic Yape button is visible; assert expanded panel and stop | `npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --grep "TC81 pre-submit" --workers=1` | Inspect current ST2 Payment first; absence means document availability, never invent fallback |

Use each candidate's isolated command only after its gate is satisfied.

## Stop conditions

- Never navigate directly to Checkout or Payment. Use cookie/setup → add-to-cart → Cart → Checkout.
- Stop authenticated execution immediately when `auth:verify` reports expiration.
- Do not retry or mask the known failure after Place Order.
- Do not run TC23–32 until eligible service data is visible and its endpoint is healthy.
- Do not edit/delete pre-existing account addresses. Only manage uniquely identifiable disposable QA data.
- After navigation to production, validate the destination and stop unless the TC explicitly requires that external page.
