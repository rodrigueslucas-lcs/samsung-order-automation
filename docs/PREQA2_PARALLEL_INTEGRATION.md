# PreQA2 parallel-work integration

This repository may have two valid lines of work at the same time:

- **live/local execution**: the headed Chrome/CDP operator discovers and executes official PreQA2 scenarios;
- **remote control plane**: mapping, ledger validation, campaign planning, closure gates, reconciliation and reporting evolve independently.

Both lines are useful. Neither should overwrite the other.

## Known live checkpoint

A clean local checkpoint was created as commit `6fc800a` (`test(preqa2): validate official MX storefront scenarios`) after the first official MX PreQA2 pass. It contained:

- `docs/PREQA2_DISCOVERY.md`
- `package.json`
- `test-mapping/mx-qst-coverage.json`
- `scripts/preqa2-safe-validation.cjs`
- `test-mapping/preqa2-validation.json`

The live operator may continue changing those files after that checkpoint. Do not use this commit hash as proof that later live work is committed.

## Integration rule

Do not pull/rebase while live work is uncommitted.

When the live operator finishes a coherent batch:

```bash
git status --short
git add <only intended live files>
git commit -m "test(preqa2): <coherent live validation batch>"
git fetch origin
git rebase origin/refactor/smb-multi-market-architecture
```

Resolve conflicts before running any tests or pushing.

## Expected conflict areas

### `package.json`

Preserve both sides:

- live runner command(s), including the headed/CDP PreQA2 validation command;
- control-plane commands for plan, closure, gate, recorder, reconciliation and reporting.

Do not resolve `package.json` by choosing one entire side.

### `test-mapping/preqa2-validation.json`

This is the highest-risk conflict because the local side may contain real runtime PASS/FAIL evidence while the remote side defines the canonical ledger contract.

Never resolve this file with blanket `--ours` or `--theirs`.

Preserve every legitimate live result. Normalize it into the canonical schema if necessary. For canonical ledgers, `utils/preqa2LedgerMerge.js` and `scripts/merge-preqa2-ledgers.cjs` can union independent results and fail closed on different results for the same official ID.

If the two versions use different schemas, first copy both versions to temporary files outside the tracked path, normalize the live evidence into the canonical fields, validate, and only then replace the tracked ledger.

### `test-mapping/mx-qst-coverage.json`

Live evidence may legitimately change MX coverage counts or individual case states. Preserve evidence-backed changes such as an official scenario moving from Missing to Full only when the persisted automation/coverage definition supports that classification. Official PASS remains valid independently from automation coverage.

## Conflict evidence checklist

For every result carried across a rebase verify:

- official market + SAM ID;
- correct Base Store/EPP context;
- guest/registered state;
- runtime path is PreQA2 and contains no sensitive query data;
- PASS/FAIL/BLOCKED semantics;
- evidence summary;
- timestamp;
- automation claim;
- no cookies/tokens/credentials.

## Post-rebase gate

After conflicts are resolved:

```bash
npm run preqa2:gate
npm run preqa2:closure:mx
npm run qst:implementation
npm run qst:mx:list
npm run qst:pe:list
git diff --check
git status --short
```

If MX live execution is supposed to have exhausted all safe candidates, also run:

```bash
PREQA2_REQUIRE_SAFE_EXHAUSTED="MX" node scripts/preqa2-gate.cjs
```

Do not push until the gate is green and the ledger contains the expected live results.

## Push rule

A successful rebase is not proof of a successful push. After the final validation:

```bash
git push origin refactor/smb-multi-market-architecture
```

Verify the remote branch head after pushing.
