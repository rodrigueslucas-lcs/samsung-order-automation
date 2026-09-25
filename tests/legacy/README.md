# Legacy automation

This boundary contains executable compatibility generations that are **not canonical for new work**.

Current content:

- `pe/qst/` — older PE QST generation moved from the historical environment-first tree.

Rules:

1. New scenarios do not start here.
2. Keep only while a package/script/governance consumer still needs the generation.
3. Reconcile by TC against the canonical market implementation before deleting.
4. Once zero runtime/governance usage is proven, delete the superseded implementation rather than keeping two sources of truth.
