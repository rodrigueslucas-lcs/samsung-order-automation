# DST Automation Structure

## Current ownership

The existing DST suite is the 83-case ST2 Peru automation currently stored under:

```text
tests/st2/base-store/
  cart/
  checkout/
  guest-login/
  home/
  mobile/
  payment/
  pdp/
  profile/
  smoke/
tests/st2/backoffice/
tests/s2/pe/dst/base-store/
  search/
tests/s2/pe/dst/epp/
```

`tests/s2/pe/dst/epp/` contains guarded thin EPP wrappers. `search/` is the completed Base Store migration pilot and both areas now use the country-scoped target convention; the remaining Base Store and BackOffice paths stay incremental.

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
2. Identify external CI/Confluence commands that reference `tests/st2/base-store` or `tests/st2/backoffice`.
3. ✅ Move the low-coupling `search/` area first into the DST layout, then normalize Search and EPP under `tests/s2/pe/dst/` with their import and runner paths.
4. ✅ Validate discovery plus the moved test. The test is collected correctly; its headed regression reached a blank ST2 document and failed before the search control, an environment load failure rather than an import/migration failure.
5. Repeat by logical area; move BackOffice last because its environment commands and discovery documentation are widely referenced.
6. Remove compatibility paths only after all consumers use `tests/st2/dst`.

Search and EPP now use the country-scoped target layout. The rest of PE Base Store and BackOffice remains on legacy `tests/st2` paths and will continue incrementally.

## Current commands

```bash
npm run dst:base-store
npm run dst:backoffice
npm run dst:epp
npm run dst:list
```
