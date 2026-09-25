# Market-first test tree

This is the canonical engineer-facing Playwright navigation.

```text
markets/
  mx/
    qst/
    dst/
  pe/
  shared/
```

Use **market -> suite -> store**. S1/S2 are runtime environments selected by configuration, not folders to duplicate.

During migration these trees are guarded mirrors of compatibility sources under `tests/s1/**`. Do not allow them to drift; run `npm run repo:architecture:validate` after structural changes.
