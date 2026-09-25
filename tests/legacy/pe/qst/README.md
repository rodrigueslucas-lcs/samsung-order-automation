# PE QST — Legacy Compatibility Generation

This is the older PE/ST2 QST generation.

It remains reachable through explicit `qst:pe:legacy:*` npm commands (and the temporary compatibility aliases `qst:normal`, `qst:modified`, `qst:sanity`, `qst:base-store`, `qst:epp`).

It is **not** the current Jenkins PE official-p1 source. Current PE P1 lives in `tests/markets/pe/qst`.

Migration plan:

1. reconcile unique TC/behavior coverage against `tests/markets/pe/qst`;
2. migrate anything still required;
3. retire the compatibility npm aliases/callers;
4. delete this legacy tree only after consumers are gone.

Do not add new regional QST coverage here unless explicitly maintaining the legacy execution contract.
