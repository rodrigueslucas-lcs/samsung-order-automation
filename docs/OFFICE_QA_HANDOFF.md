# ST2 Peru QA Handoff

## Current baseline

The official Base Store matrix contains 83 scenarios:

| Automated | Partial | Blocked | Not Applicable | Pending | Total |
|---:|---:|---:|---:|---:|---:|
| 61 | 9 | 9 | 2 | 2 | 83 |

`docs/COVERAGE_MATRIX.md` is the source of truth. Supplementary tests do not change this count.

## Architecture

- Specs under `tests/st2/` orchestrate business scenarios.
- Page Objects under `pages/` own locators, interaction and reusable UI assertions.
- Deterministic customer/address/payment fixtures are exposed through `utils/testData.js`.
- Storefront reusable authentication is handled by `utils/authState.js` plus the `auth:*` npm scripts.
- BackOffice uses runtime environment selection and credentials; S2 is the default and S3 must be explicit.
- Chrome is the configured channel, with one worker. Screenshots and failure traces are enabled by default.

## Safety boundaries

- Never run storefront or BackOffice writes against Production.
- My Account links may point to Production, but automation must rewrite only approved Samsung paths to `stg2.shop.samsung.com` and reject any final Production interaction. Direct ST2 Orders and Wishlist work; Profile/Address Management remains absent.
- Tests containing `@destructive` can create orders or submit a provider. Exclude them from ordinary regression.
- TC59 is statically skipped while Samsung Care+ is removed at Checkout as unavailable/out of stock.
- Alternative-provider submit requires both an approved `STOREFRONT_PAYMENT_MODE` and `ALLOW_PAYMENT_SUBMIT=1`; the helper clicks once and never retries.
- BackOffice CronJobs/cancellation require explicit staging authorization and are not part of storefront regression.
- Never commit `.env`, `playwright/.auth/`, `playwright/profiles/`, `test-results/`, reports or runtime evidence.

## Authentication

Authentication is human bootstrap plus reusable storefront state:

```powershell
npm run auth:open-profile
npm run auth:export
npm run auth:verify
```

The dedicated profile is `playwright/profiles/st2-peru-qa`; exported state is under `playwright/.auth/`. Both are ignored secrets. Specs use `hasAuthState()` and skip clearly when the state is absent or expired. Do not automate Google/FedCM/CAPTCHA/MFA.

## Checkout and payment

- Checkout must be reached through Product → Cart → Guest/Authenticated Checkout.
- The primary deterministic SKU is `RB45DG6300B1PE`.
- Additional Services requires order-sensitive setup: add `SM-F741BLBKPEO`, then `RB45DG6300B1PE`, then open Cart.
- Add-to-cart is never retried because repeating it changes cart quantity. A blank/hydrating Cart may be reloaded safely without repeating add-to-cart.
- Credit Card, Banca por Internet, Pago Efectivo, Cuotéalo and Acuotaz have proven coverage recorded in the matrix.
- Yape remains Blocked because the current `paymentmodes` API does not return `pe-yape`.
- Provider evidence stores only sanitized origin/path/status. Do not log response bodies, tokens or query strings.

## Windows teardown

`browserContext.close: spawn EPERM` was isolated to Playwright video/FFmpeg on the managed Windows machine. Real Chrome closes normally with screenshots and tracing. Video is opt-in:

```powershell
$env:PW_VIDEO = "1"
```

Enable it only after the matching Playwright FFmpeg is installed and allowed by corporate policy. Default `trace: retain-on-failure` preserves failure evidence and avoids trace artifact locks on statically skipped tests.

## Remaining scenarios

### Partial

| TCs | What remains | Dependency / next action |
|---|---|---|
| 1, 2 | Full registered login rather than reusable-session validation | Human Samsung/Google/FedCM/MFA decision; keep provider login manual |
| 3, 5 | Successful authenticated callback after the proven Checkout login entry | Same identity-provider dependency; reuse a renewed auth state for downstream tests |
| 13 | Valid guest order lookup and OTP correlation | Checkout-generated order/email plus inbox/OTP access; never use arbitrary existing orders |
| 14 | Hero and Top Seller presence | ST2 CMS/catalog content; helper reports each attribute independently |
| 19 | Recommended Products alongside Additional Services | Catalog/service data returning a recommendation block |
| 59 | Completed IM order with Trade-in and SC+ | Samsung Care+ stock/configuration must stop removing the service at Checkout |

### Blocked

| TCs | Blocker | Next action |
|---|---|---|
| 67, 68 | Accessible staging orders expose no valid cancellation controls | Samsung team supplies a cancelable S3 order/state; then cancel once and validate the same order |
| 70 | Anonymous identity/safe address is not proven | Samsung team confirms the canonical Anonymous user and disposable staging address |
| 81 | `pe-yape` absent from current payment modes API | Payment configuration enables Yape; rerun read-only discovery before any provider submit |

### Pending

| TC | Required evidence | Next action |
|---:|---|---|
| 4 | Applicable Order Confirmation email with a registered-login link | Confirm the email template/requirement, then validate a link from an approved test inbox |
| 63 | Receipt of acknowledgement email correlated to order code/email | Provide test inbox access and a newly approved automation-created order; do not infer delivery from UI confirmation |

No email/inbox connector currently exists in this repository.

## Useful commands

All commands use real Chrome from `playwright.config.js`.

```powershell
# A. Non-destructive smoke
npx playwright test tests/st2/base-store/home/home.spec.js tests/st2/base-store/mobile/mobile.spec.js tests/st2/base-store/guest-login/guest-login.spec.js --project=chromium --workers=1 --headed

# B. Cart (ephemeral cart mutations only; TC59 is not in this group)
npx playwright test tests/st2/base-store/cart --project=chromium --workers=1 --headed

# C. Checkout pre-submit
npx playwright test tests/st2/base-store/checkout/checkout.spec.js --project=chromium --workers=1 --headed

# D. Payment read-only
npx playwright test tests/st2/base-store/payment/payment.spec.js --project=chromium --grep-invert "@destructive" --workers=1 --headed

# E. Mobile read-only
npx playwright test tests/st2/base-store/mobile/mobile.spec.js --project=chromium --workers=1 --headed

# F. Full safe storefront regression
npx playwright test tests/st2/base-store/home/home.spec.js tests/st2/base-store/mobile/mobile.spec.js tests/st2/base-store/guest-login/guest-login.spec.js tests/st2/base-store/pdp/product.spec.js tests/st2/base-store/pdp/pdp.spec.js tests/st2/base-store/cart tests/st2/base-store/checkout/checkout.spec.js tests/st2/base-store/payment/payment.spec.js --project=chromium --grep-invert "@destructive" --workers=1 --headed

# G. Authenticated block after manual renewal
npm run auth:verify
npx playwright test tests/st2/base-store/checkout/authenticated-checkout.spec.js --project=chromium --workers=1 --headed

# H. TC12 with existing order (read-only direct ST2 route)
$env:AUTHENTICATED_ORDER_CODE="PE260826-74796841"
npx playwright test tests/st2/base-store/profile/authenticated-profile.spec.js --project=chromium --grep "TC12 -" --workers=1 --headed

# I. BackOffice read-only, future use with runtime staging credentials
npx playwright test tests/st2/backoffice/backoffice.spec.js --project=chromium --grep "TC64|TC65|TC66|TC69|TC71" --workers=1 --headed
```

## Stop conditions

- Stop before Production navigation, external-provider completion, unexpected persistent account mutation or unapproved BackOffice write.
- Treat missing auth as a skip, not a reason to request login during guest regression.
- Treat a submit timeout as ambiguous; never retry Place Order/provider submit automatically.
- Keep environment health separate from official coverage already proven functionally.
