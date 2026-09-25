# Page Objects

`pages/` contains browser interaction abstractions shared by the current MX and PE automation generations.

## Current state

The folder is intentionally flat for compatibility. Some classes are truly shared (`ProductPage`, `CartPage`, etc.), while others already expose market or product-area ownership (`MxCheckoutPage`, `GuestOrderTrackingPage`, `BackOffice*`).

Do not move a Page Object solely because its filename looks market-specific without updating all active imports atomically.

## Target ownership

```text
pages/
  shared/       cross-market storefront components
  mx/           MX-specific checkout/tracking behavior
  pe/           PE-specific behavior
  backoffice/   BackOffice-only components
```

Large Page Objects should be split by stable business responsibility, not arbitrary file size. Path cleanup happens before deeper Page Object decomposition so import churn occurs once.

## Safety rule

A Page Object move/refactor is complete only after all current consumers (MX QST, MX DST, PE QST/DST and reporting/integration tests where applicable) are updated and the affected runtime gate is validated.
