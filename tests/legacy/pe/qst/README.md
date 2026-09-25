# PE QST — Legacy Compatibility Generation

This tree is the **older PE QST generation** retained for reconciliation and compatibility commands.

It is still reachable through legacy npm aliases backed by `scripts/qst-run.cjs`:

```text
qst:normal
qst:modified
qst:sanity
qst:base-store
qst:epp
```

Those aliases now route explicitly into `tests/legacy/pe/qst`, so engineers can tell immediately that they are not the canonical regional implementation.

It is **not** the Jenkins PE `official-p1` stabilization source. The canonical PE runner uses:

```text
tests/markets/pe/qst/base-store
```

Migration plan:

1. reconcile behavior/official IDs against `tests/markets/pe/qst`;
2. migrate still-needed coverage into the canonical tree;
3. retire the compatibility npm aliases;
4. remove reuse-plan references to superseded specs;
5. delete this tree only after zero runtime/governance consumers remain.

Do not add new regional QST coverage here unless explicitly maintaining a legacy compatibility lane.
