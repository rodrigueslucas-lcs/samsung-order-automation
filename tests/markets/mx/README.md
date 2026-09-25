# MX Automation

Canonical MX executable tree.

- `qst/base-store/` — stabilized active MX Base Store P1 implementation.
- `dst/` — MX DST coverage plus current auth/flow helpers reused by QST.

S1/S2 are selected at runtime through `MX_QST_ENVIRONMENT`; there is no environment-owned duplicate tree.

Current regression baseline: 29 selected/executed, 28 PASS, `SAM-25010` functional Track Order failure, 0 blocked/not-run.
