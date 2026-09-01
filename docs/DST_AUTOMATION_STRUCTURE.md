# DST Automation Structure

## Current ownership

The existing DST suite is the 83-case ST2 Peru automation currently stored under:

```text
tests/s2/pe/dst/base-store/
  cart/
  checkout/
  guest-login/
  home/
  mobile/
  payment/
  pdp/
  profile/
  search/
  smoke/
tests/s2/pe/dst/epp/
tests/s2/pe/dst/backoffice/
```

`tests/s2/pe/dst/epp/` contains guarded thin EPP wrappers. PE DST Base Store and BackOffice now use the country-scoped target convention; fulfillment evidence remains explicitly S3.

QST is already separate under `tests/st2/qst/`. Page Objects in `pages/`, fixtures and utilities remain shared infrastructure and must not be copied into either suite.

## Desired target

```text
tests/s2/pe/
  dst/
    base-store/
    epp/
    backoffice/
  qst/
    base-store/
    epp/
```

## Migration impact

A big-bang move would change every relative import depth in the DST specs and invalidate commands, documentation paths, handoff instructions and external CI references. It would also create a noisy rename diff that is difficult to review alongside active QST work. The Page Objects themselves do not need to move.

## Incremental plan

1. ✅ Add explicit `dst:*` npm commands pointing at the current paths, without moving files.
2. ✅ Identify external CI/Confluence consumers of the legacy Base Store and BackOffice paths.
3. ✅ Move the low-coupling `search/` area first into the DST layout, then normalize Search and EPP under `tests/s2/pe/dst/` with their import and runner paths.
4. ✅ Validate discovery plus the moved test. The test is collected correctly; its headed regression reached a blank ST2 document and failed before the search control, an environment load failure rather than an import/migration failure.
5. ✅ Move Home, PDP, Cart, Guest Login, Profile, Mobile and Smoke by logical area.
6. ✅ Move Checkout and Payment, validate guarded submit specs by list only, and remove the legacy Base Store collection path.
7. ✅ Move BackOffice last, preserve its S2/S3 environment behavior, and keep CronJob execution out of the default command.
8. Remove the remaining compatibility path only after QST consumers use country-scoped paths.

PE DST Base Store, EPP and BackOffice now use the country-scoped target layout. QST remains on legacy `tests/st2/qst` paths and will continue incrementally.

## Current commands

```bash
npm run dst:base-store
npm run dst:backoffice
npm run dst:epp
npm run dst:list
```
