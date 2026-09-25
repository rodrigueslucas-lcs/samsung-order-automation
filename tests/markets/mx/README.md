# MX Automation — Active Compatibility Path

This is the **active MX automation tree** today.

- `qst/base-store/` contains the stabilized active MX Base Store P1 implementation.
- `dst/` contains MX DST coverage plus auth/flow helpers still imported by current QST code.

The `s1` segment is historical physical organization. The runner can target S1 or S2 through runtime configuration; do not interpret this directory as S1-only behavior and do not create a duplicate `tests/s2/mx` tree.

Target migration: `tests/mx/{qst,dst}/...` once runner/import/report paths can be changed atomically and runtime-validated.
