# Tests

This directory is executable Playwright automation.

## Current compatibility layout

The repository still contains an environment-first physical structure:

```text
tests/s1/mx/...
tests/s1/pe/...
tests/s1/smb/...
tests/s2/pe/...
```

That structure reflects project history, not the desired final architecture.

## Target rule

New architecture should converge to:

```text
tests/<market>/<qst|dst>/<store>/
```

S1/S2 are runtime environments and should ultimately be selected by configuration rather than duplicated top-level directories.

Do **not** create a new test in both S1 and S2 merely to support both environments. Reuse one spec and route endpoints/config at runtime whenever the business flow is equivalent.

## Current ownership

- `s1/mx/qst/base-store` — active MX QST implementation and official Base Store P1 runner.
- `s1/mx/dst` — MX DST generation and shared MX auth/flow compatibility used by current QST imports.
- `s1/pe/qst` — newer PE QST stabilization generation.
- `s2/pe/qst` — older PE/ST2 QST generation; migration candidate, not safe to delete yet.
- `s2/pe/dst` — established PE DST generation and still referenced by package scripts.
- `s1/smb/qst` — shared/regional candidates.

## Migration safety

Moving test folders affects relative imports, Playwright project matching, runners, Jenkins commands, package scripts and reporting source paths. Perform those moves atomically and validate the affected official runner before deleting the old path.

For MX-affecting changes, the regression baseline is the active 29-TC Base Store P1 campaign documented in `docs/REPOSITORY_AUDIT.md`.
