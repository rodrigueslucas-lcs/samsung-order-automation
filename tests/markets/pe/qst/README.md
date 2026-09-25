# PE QST — Canonical Regional Stabilization

This tree is the **canonical PE Base Store P1 stabilization implementation** used by `scripts/run-pe-qst-p1.cjs` and the Jenkins PE `official-p1` lane.

Canonical path:

```text
tests/markets/pe/qst/base-store/
```

S1/S2 is selected through `PE_QST_ENVIRONMENT` / runtime configuration; environment is not encoded in the physical test path.

The older PE QST generation is retained explicitly under:

```text
tests/legacy/pe/qst/
```

Use that tree only as a reconciliation/reuse source. New PE QST work belongs here under `tests/markets/pe/qst`.
