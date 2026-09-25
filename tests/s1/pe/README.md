# Peru (PE) automation

`tests/markets/pe` is the canonical destination for current PE automation.

## Ownership

```text
tests/markets/pe/
  qst/
    base-store/
```

New PE QST work belongs here. Environment is runtime configuration; do not create `s1/` or `s2/` folders under this market.

The older ST2 implementation is intentionally isolated under `tests/legacy/pe-s2`. It is migration input and still contains established DST coverage. It is **not** a second current PE architecture.

## Reconciliation rule

Before deleting or superseding a legacy PE spec:

1. identify the official/business capability it carries;
2. identify every package/Jenkins/runtime consumer;
3. move or re-implement the capability in the canonical market tree;
4. prove the canonical path in the target runtime;
5. remove the legacy consumer first, then the legacy file.

Use:

```bash
npm run repo:pe:audit
npm run repo:pe:audit:strict
```

The audit compares canonical official SAM IDs with the historical PE QST registry and validates the legacy reuse-plan candidate paths.

## Current status

PE canonical QST code is a stabilization generation, not runtime proof. Do not infer PASS or official coverage from file presence. PE S2/S1 credentials and live baselines remain separate acceptance work.
