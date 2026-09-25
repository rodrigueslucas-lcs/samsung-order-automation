# PE QST Compatibility Guide

> Historical/compatibility guide for the original Peru QST generation under `tests/s2/pe/qst`. It is retained while PE is reconciled with the newer regional QST implementation under `tests/s1/pe/qst`. It is **not** the current MX QST guide and must not be used as a current SMB scope source.

## Scope and separation from DST

This PE QST generation was designed as an operational suite independent from the established Peru Detailed Smoke Test (DST). QST specs may reuse existing Page Objects/helpers, while QST IDs, execution and evidence remain separate from DST.

The original implementation model described 22 Base Store scenarios and 22 EPP scenarios. Treat those numbers as historical PE implementation context, not the current official Samsung P1/P2 denominator.

## Execution types

- **Normal:** regular QST coverage when no targeted code-change validation is required.
- **Modified:** applicable subset for a changed service/functionality/pull request.
- **Sanity:** minimum subset for configuration changes, restarts and upgrades without a code change.

A scenario has one implementation and carries applicable tags; implementations are not copied per execution type.

## Compatibility structure

```text
tests/s2/pe/qst/
  base-store/
  epp/
```

Shared tags include `@qst`, `@qst-normal`, `@qst-modified`, `@qst-sanity`, `@base-store` and `@epp`.

This environment-first path is compatibility debt. The target repository architecture is market-first (`tests/pe/qst/...`) after the `tests/s1/pe` and `tests/s2/pe` generations are reconciled TC-by-TC.

## Legacy commands

```bash
npm run qst:normal
npm run qst:modified
npm run qst:sanity
npm run qst:base-store
npm run qst:epp
```

These commands remain compatibility entry points while the older PE generation exists.

## Authentication and environments

- Base Store guest wrappers use ST2 Peru and the existing setup flow.
- Registered scenarios reuse ignored Playwright auth state only when a valid QA session exists.
- BackOffice scenarios support staging environment selection and runtime-only credentials.
- EPP functional automation must not follow staging links that resolve into Production.

## Destructive guards

- external payment/order creation requires `ALLOW_PAYMENT_SUBMIT=1`;
- state-changing BackOffice flows retain environment/credential guards;
- Place Order remains opt-in and must never be blindly retried after an ambiguous submit;
- cancellation, CronJobs and Production writes remain guarded/read-only as appropriate.

## Migration rule

Do not add new regional architecture on top of this path merely because the old command exists. New PE stabilization work should follow the active regional plan, and this compatibility generation should be removed only after its unique coverage/consumers have been reconciled.

See:

- `REPOSITORY_AUDIT.md`
- `CURRENT_ARCHITECTURE.md`
- `OFFICIAL_SMB_PRIORITY_MODEL.md`
