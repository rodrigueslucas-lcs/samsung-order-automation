# Tests

This directory contains executable Playwright automation plus a temporary compatibility layer used during the architecture migration.

## Canonical navigation

Engineers should navigate tests through the market-first tree:

```text
tests/
  markets/
    mx/
      qst/base-store/
      dst/base-store/
      dst/backoffice/
    pe/
      qst/...
    shared/
      qst/...
  legacy/
    pe-s2/
```

The rule is **market -> suite -> store**. S1/S2 are runtime environments, not permanent physical taxonomy.

## Compatibility paths

`tests/s1/**` and `tests/s2/**` are temporarily retained so the already-stabilized official runners/Jenkins paths can be migrated without a big-bang regression. VS Code hides those compatibility roots by default, so day-to-day navigation stays clean.

Canonical trees are currently mirrored byte-for-byte from their compatibility sources and protected by:

```bash
npm run repo:architecture:validate
```

The guard fails if the canonical and compatibility copies drift before runtime cutover.

## Ownership

- `markets/mx/qst/base-store` — stabilized active MX QST implementation and official Base Store P1 source.
- `markets/mx/dst` — MX DST plus auth/flow compatibility used by current QST imports.
- `markets/pe` — newer PE QST stabilization generation.
- `markets/shared` — cross-market SMB candidates.
- `legacy/pe-s2` — older PE/ST2 QST + established DST generation kept until PE reconciliation is complete.

Do not create separate S1/S2 copies of the same business scenario. Route environment-specific endpoints/configuration at runtime.

For MX-affecting structural changes, the acceptance baseline remains 29 selected / 29 executed / 28 PASS / 1 known functional FAIL (`SAM-25010`) / 0 BLOCKED / 0 NOT_RUN.
