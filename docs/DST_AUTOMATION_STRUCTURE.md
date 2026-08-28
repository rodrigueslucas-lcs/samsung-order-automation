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
  search/
  smoke/
tests/st2/backoffice/
```

QST is already separate under `tests/st2/qst/`. Page Objects in `pages/`, fixtures and utilities remain shared infrastructure and must not be copied into either suite.

## Desired target

```text
tests/st2/
  dst/
    base-store/
    backoffice/
  qst/
    base-store/
    epp/
```

## Migration impact

A big-bang move would change every relative import depth in the DST specs and invalidate commands, documentation paths, handoff instructions and external CI references. It would also create a noisy rename diff that is difficult to review alongside active QST work. The Page Objects themselves do not need to move.

## Incremental plan

1. Add explicit `dst:*` npm commands pointing at the current paths, without moving files.
2. Identify external CI/Confluence commands that reference `tests/st2/base-store` or `tests/st2/backoffice`.
3. Move one low-coupling DST area, such as `search/`, into `tests/st2/dst/base-store/` and update only its imports and commands.
4. Validate `playwright --list` plus that area's tests.
5. Repeat by logical area; move BackOffice last because its environment commands and discovery documentation are widely referenced.
6. Remove compatibility paths only after all consumers use `tests/st2/dst`.

No DST files are moved in this QST expansion round. This preserves the committed 83-case suite and keeps the current work focused on QST evidence.
