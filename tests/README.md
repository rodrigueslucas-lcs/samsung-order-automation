# Tests

Executable Playwright automation is organized by **ownership**, not environment.

```text
tests/
  markets/
    mx/
      qst/
      dst/
    pe/
      qst/
      dst/
  shared/
    smb/
      qst/
  legacy/
    pe/
      qst/
```

## Rule

S1/S2 are runtime environments. They do not own physical spec trees.

Use one market-owned spec and route storefront/API configuration with `MX_QST_ENVIRONMENT`, `PE_QST_ENVIRONMENT` or the corresponding runtime config whenever business behavior is equivalent.

## Ownership

- `markets/mx/qst/base-store` — active MX QST and official 29-TC Base Store P1 implementation.
- `markets/mx/dst` — MX DST plus current MX auth/flow compatibility used by QST.
- `markets/pe/qst` — current regional PE QST stabilization implementation.
- `markets/pe/dst` — established PE DST implementation.
- `shared/smb/qst` — explicitly shared/regional candidate coverage.
- `legacy/pe/qst` — older PE/ST2 QST generation retained only for compatibility commands until reconciliation is complete.

## Safety

Do not add new code under `legacy/` unless explicitly maintaining a legacy entry point. Do not recreate `tests/s1` or `tests/s2`.

For MX-affecting changes, preserve the established 29-TC campaign behavior documented in `docs/REPOSITORY_AUDIT.md`. Physical refactors are not considered runtime-proven until the official gates/runner execute successfully.
