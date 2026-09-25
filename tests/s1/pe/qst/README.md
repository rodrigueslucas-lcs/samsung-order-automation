# PE QST — Current Regional Stabilization Path

This tree is the **current PE Base Store P1 stabilization implementation** used by `scripts/run-pe-qst-p1.cjs` and the Jenkins PE official-p1 lane.

The runner currently discovers `tests/s1/pe/qst/base-store` even when `PE_QST_ENVIRONMENT=S2`; therefore the `s1` directory name is compatibility debt, not an environment restriction.

Do not copy these specs into a second environment directory. Target migration is `tests/pe/qst/...` after the older `tests/s2/pe/qst` generation is reconciled.
