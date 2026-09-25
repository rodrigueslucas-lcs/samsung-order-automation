# MX QST

Canonical Mexico QST automation lives under `base-store/`.

The official active MX Base Store P1 runner selects 29 TCs from this tree. `SAM-25006` remains an audited historical/source exclusion because the inherited PSE path is Colombia-specific.

S1/S2 is runtime configuration through `MX_QST_ENVIRONMENT`; do not create separate environment-owned MX test folders.

Runtime acceptance baseline from Jenkins #49 before this path refactor:

```text
29 selected / 29 executed
28 PASS
1 known functional FAIL: SAM-25010 Track Order
0 BLOCKED / 0 NOT_RUN
```

The market-first refactor is not runtime-proven until that official campaign preserves the baseline.
