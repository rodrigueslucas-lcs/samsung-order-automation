# Peru EPP Discovery

This document consolidates EPP facts shared by QST (22 scenarios) and DST (59 scenarios). Their matrices, execution evidence and automation statuses remain independent.

## Confirmed

- The existing ignored Samsung Account state authenticates successfully in the ST2 Base Store.
- The authenticated ST2 homepage exposes no EPP or employee-store entry.
- `/pe/campaign/select-ai` is a Select AI/subscription route, not EPP. In ST2 it renders only the application shell and its CMS page requests return HTTP 404.
- The known Peru employee program paths are `/pe/multistore/beneficios_empleados/` and `/pe/multistore/ventaempleados/`.
- Opening either path from `stg2.shop.samsung.com` attempts to load `www.samsung.com/shop/`. The automated discovery blocks that Production request.
- No functional Product, Cart, Checkout, Address, Payment, Order, BackOffice or fulfillment interaction has been performed for EPP.
- QST EPP remains 0 Automated / 22 Blocked.
- DST EPP historic manual Pass results are not current automation evidence.

## Hypotheses

- `beneficios_empleados` may represent partner-company employees, while `ventaempleados` may represent Samsung internal employees.
- EPP may use the same storefront components and SAP Commerce APIs as Base Store after store/entitlement selection.
- The current Samsung Account may be reusable after EPP entitlement is granted.
- EPP orders may share one of the existing S1/S2/S3 BackOffice environments.

These hypotheses must not drive functional tests until verified in staging.

## Needs Samsung input

- Current Peru EPP staging URL and safe host.
- Program/store variant used by the official matrices.
- Base Site UID, Base Store UID, catalog and catalog version.
- EPP entitlement/bootstrap mechanism and an eligible QA account.
- Stable EPP IM, CE, Trade-In and Samsung Care+ SKUs.
- Supported EPP staging payment modes and recommended smoke payment.
- EPP BackOffice environment/order identifier and runtime authorities.
- EPP fulfillment job names and safe causal order mass.

## Runtime configuration prepared

The repository now accepts these runtime-only values:

| Variable | Purpose |
|---|---|
| `EPP_STOREFRONT_URL` | Verified non-Production EPP entry URL |
| `EPP_STAGING_HOST_ALLOWLIST` | Explicit comma-separated allowlist when the supplied staging hostname lacks a staging marker |
| `EPP_SITE_UID` | Base Site/site UID metadata |
| `EPP_BASE_STORE_UID` | Base Store UID metadata |
| `EPP_SMOKE_SKU` | Stable EPP smoke product |
| `EPP_SMOKE_PDP_URL` | Verified EPP PDP for the smoke product |
| `EPP_CART_URL` | Verified EPP cart route |
| `EPP_ACCOUNT_URL` | Verified EPP My Account route |
| `EPP_ORDERS_URL` | Verified EPP My Orders route |
| `EPP_ORDER_CODE` | QA-owned EPP order for read-only validation |
| `EPP_BACKOFFICE_URL` | Verified non-Production EPP BackOffice URL |

Production Samsung storefront hosts are rejected. No credential or entitlement value is persisted.

## Safe next validation

Once the P0 configuration is supplied, run `npm run dst:epp`. The bootstrap first proves a non-Production document, stable host and non-empty page. The current thin wrappers then exercise shared Page Objects; no scenario is promoted until its own EPP execution passes.
