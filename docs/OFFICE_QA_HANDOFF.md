# ST2 Peru QA Handoff

## Current baseline

The official Base Store matrix contains 83 scenarios:

| Automated | Partial | Blocked | Not Applicable | Pending | Total |
|---:|---:|---:|---:|---:|---:|
| 63 | 9 | 9 | 2 | 0 | 83 |

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
| 13 | Complete the final OTP submission and guest order/status assertion | Guest tracking flow and automatic OTP extraction were validated in prior execution, but the latest end-to-end rerun could not complete because the OTP email was not delivered to the test inbox within the configured timeout. The request was accepted once, no resend occurred, and the current locator was not the failure. |
| 14 | Hero and Top Seller presence | ST2 CMS/catalog content; helper reports each attribute independently |
| 19 | Recommended Products alongside Additional Services | Catalog/service data returning a recommendation block |
| 59 | Completed IM order with Trade-in and SC+ | Samsung Care+ stock/configuration must stop removing the service at Checkout |

### Blocked

| TCs | Blocker | Next action |
|---|---|---|
| 67, 68 | Accessible staging orders expose no valid cancellation controls | Samsung team supplies a cancelable S3 order/state; then cancel once and validate the same order |
| 70 | Anonymous identity/safe address is not proven | Samsung team confirms the canonical Anonymous user and disposable staging address |
| 81 | `pe-yape` absent from current payment modes API | Payment configuration enables Yape; rerun read-only discovery before any provider submit |

No email/inbox connector currently exists in this repository.

## Order email evidence

- Manual ST2 evidence confirms sender `Customer Services Team` and delivery to the corporate Outlook folder `Samsung eStore`.
- `¡Recibimos tu pedido!` is the acknowledgment/order-received template.
- `¡Pago confirmado!` is the payment-confirmation template.
- Shipment or later status templates have not yet been observed, so their sender, subject and CTA must not be inferred.
- Minimum TC63 validation is sender, exact expected subject for the lifecycle stage, correlated order code, order date and stage-appropriate main content.
- Example manual evidence: order `PE260827-74844022`. This proves ST2 mail delivery, but not automated inbox correlation.
- Public-inbox evidence for automation-created order `PE260828-74946004`: `Customer Services Team` / `customerservice@shopmail.samsung.com`, subject `¡Pago confirmado!`, order date `28 de agosto de 2026`, payment-confirmed copy and order summary. Delivery occurred after the five-minute polling attempt, and the Mailinator public API was intermittently unavailable.
- TC63 is Automated through the Mailinator web UI, without using its unstable public API. Headed real Chrome created exactly one ST2 order, `PE260828-74946006`, then searched inbox `s2tc63-0828-1646` through the header/`GO` flow and correlated `¡Pago confirmado!`, `customerservice@shopmail.samsung.com`, the same order code and `28 de agosto de 2026`. The email evidence screenshot was captured 55 seconds after the confirmation screenshot.
- TC4 is Automated: headed real Chrome followed the existing `Mi cuenta` email CTA supplied through runtime-only `ORDER_EMAIL_CTA_URL`, resolved to ST2 `/pe/mypage/orders`, preserved the authenticated session and validated `Pedidos` plus `Cerrar sesión`. Optional order correlation is enabled only with `ORDER_EMAIL_EXPECT_ORDER=1`; the evidence order was created as guest and correctly did not belong to the registered account.
- Public Mailinator is temporary discovery evidence only: inbox contents are public and ephemeral, so it is not suitable for personal data or stable CI architecture.
- Do not automate Outlook Desktop with Playwright and do not invent an inbox API. Automation requires an approved integration such as Microsoft Graph/IMAP or an existing test-inbox connector with least-privilege access.

### Recommended TC63 inbox architecture

1. Prefer Microsoft Graph with a dedicated Outlook QA mailbox/folder, least-privilege read access and order-code correlation.
2. If available inside the staging platform, prefer an internal mail catcher because it avoids external delivery delay and public exposure.
3. A shared QA inbox is acceptable when it offers an approved programmatic interface, retention policy and ownership for credential rotation.
4. A private test-email service is the external fallback; use a private inbox/API, never a public Mailinator mailbox, and keep credentials in runtime secrets.

TC63 currently has automated functional coverage through the public web UI. The options above remain the recommended hardening path for private, long-term CI execution.

Run the destructive email validation only with explicit guards and a fresh short inbox:

```powershell
$env:ALLOW_PAYMENT_SUBMIT = "1"
$env:VALIDATE_ORDER_EMAIL = "1"
$env:MAILINATOR_INBOX = "s2tc63-MMDD-HHmm"
$env:STOREFRONT_GUEST_EMAIL = "$env:MAILINATOR_INBOX@mailinator.com"
npx playwright test tests/s2/pe/dst/base-store/smoke/guest-checkout.spec.js --project=chromium --grep "optional TC63 email validation" --workers=1 --headed
```

## Useful commands

All commands use real Chrome from `playwright.config.js`.

```powershell
# A. Non-destructive smoke
npx playwright test tests/s2/pe/dst/base-store/home/home.spec.js tests/s2/pe/dst/base-store/mobile/mobile.spec.js tests/s2/pe/dst/base-store/guest-login/guest-login.spec.js --project=chromium --workers=1 --headed

# B. Cart (ephemeral cart mutations only; TC59 is not in this group)
npx playwright test tests/s2/pe/dst/base-store/cart --project=chromium --workers=1 --headed

# C. Checkout pre-submit
npx playwright test tests/s2/pe/dst/base-store/checkout/checkout.spec.js --project=chromium --workers=1 --headed

# D. Payment read-only
npx playwright test tests/s2/pe/dst/base-store/payment/payment.spec.js --project=chromium --grep-invert "@destructive" --workers=1 --headed

# E. Mobile read-only
npx playwright test tests/s2/pe/dst/base-store/mobile/mobile.spec.js --project=chromium --workers=1 --headed

# F. Full safe storefront regression
npx playwright test tests/s2/pe/dst/base-store/home/home.spec.js tests/s2/pe/dst/base-store/mobile/mobile.spec.js tests/s2/pe/dst/base-store/guest-login/guest-login.spec.js tests/s2/pe/dst/base-store/pdp/product.spec.js tests/s2/pe/dst/base-store/pdp/pdp.spec.js tests/s2/pe/dst/base-store/cart tests/s2/pe/dst/base-store/checkout/checkout.spec.js tests/s2/pe/dst/base-store/payment/payment.spec.js --project=chromium --grep-invert "@destructive" --workers=1 --headed

# G. Authenticated block after manual renewal
npm run auth:verify
npx playwright test tests/s2/pe/dst/base-store/checkout/authenticated-checkout.spec.js --project=chromium --workers=1 --headed

# H. TC12 with existing order (read-only direct ST2 route)
$env:AUTHENTICATED_ORDER_CODE="PE260826-74796841"
npx playwright test tests/s2/pe/dst/base-store/profile/authenticated-profile.spec.js --project=chromium --grep "TC12 -" --workers=1 --headed

# I. BackOffice read-only, future use with runtime staging credentials
npx playwright test tests/st2/backoffice/backoffice.spec.js --project=chromium --grep "TC64|TC65|TC66|TC69|TC71" --workers=1 --headed
```

## Stop conditions

- Stop before Production navigation, external-provider completion, unexpected persistent account mutation or unapproved BackOffice write.
- Treat missing auth as a skip, not a reason to request login during guest regression.
- Treat a submit timeout as ambiguous; never retry Place Order/provider submit automatically.
- Keep environment health separate from official coverage already proven functionally.
