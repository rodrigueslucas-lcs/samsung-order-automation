# PE QST — Current Regional Implementation

Canonical current PE QST tree used by `scripts/run-pe-qst-p1.cjs` and the Jenkins PE official-p1 stabilization lane.

S1/S2 are selected at runtime through `PE_QST_ENVIRONMENT`; do not duplicate these specs by environment.

The older PE/ST2 QST generation is isolated under `tests/legacy/pe/qst` until unique coverage and legacy callers are fully reconciled.
