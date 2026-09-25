# PE QST — Legacy Compatibility Generation

This tree is the **older PE/ST2 QST generation**.

It is still reachable through legacy npm commands implemented by `scripts/qst-run.cjs` (`qst:normal`, `qst:modified`, `qst:sanity`, `qst:base-store`, `qst:epp`), so it is not safe to delete yet.

It is **not** the current Jenkins PE official-p1 stabilization source. The current regional PE P1 runner uses `tests/s1/pe/qst/base-store`.

Migration plan:

1. reconcile unique TC/behavior coverage against `tests/s1/pe/qst`;
2. migrate any still-needed coverage;
3. retire/rename legacy npm entry points;
4. delete this tree only after consumers are gone;
5. converge on `tests/pe/qst/...`.

Do not add new regional QST coverage here unless explicitly maintaining a legacy execution path.
