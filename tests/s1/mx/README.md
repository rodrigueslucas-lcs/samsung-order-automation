# Mexico (MX) automation

`tests/markets/mx` is the canonical MX automation tree.

```text
tests/markets/mx/
  qst/
    base-store/
  dst/
    base-store/
    backoffice/
```

## Runtime model

The physical path is market-first. S1/S2 are selected at runtime through MX configuration and Jenkins parameters; do not create environment-specific MX test trees.

The active official MX Base Store P1 runner selects 29 TCs. `SAM-25006` remains an audited business-scope exclusion until a valid MX-specific Rewards execution path exists.

The last proven pre-cutover Jenkins baseline was 29 executed / 28 PASS / 1 known functional FAIL (`SAM-25010` Track Order after accepted OTP). The canonical-path refactor on the current branch still requires its own official acceptance run before hidden compatibility mirrors are deleted.

## Rules

- new MX QST/DST work belongs under this canonical market tree;
- no new references to `tests/s1/mx` are allowed in active CI/runners;
- keep environment selection in config/runtime, never in folder taxonomy;
- do not change business assertions just to make an environment/backend failure green;
- after structural changes run `npm run repo:architecture:validate` before runtime acceptance.

Temporary `tests/s1/mx` is a hidden byte-identical migration mirror only. It is not an engineer-facing source of truth and will be deleted after the canonical-path Jenkins acceptance gate passes.
