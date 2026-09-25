# Reporting

`reporting/` is the canonical reporting boundary for Jenkins and local validation.

Responsibilities:

- `evidence/` — structured evidence model and Playwright reporter;
- `executive-v3/` — current Executive Dashboard generator;
- `executive/` — previous executive generator retained while compatibility/integrity consumers still exercise it;
- `preqa2/` — PreQA2 campaign/status reporting;
- `tests/` — reporting integrity tests.

During migration the hidden root `reporters/` tree is a byte-identical compatibility source for callers not yet cut over. Do not add separate logic to both trees. Structural guards fail if they drift.

Long-term rule: one reporting ownership boundary, with Executive, Allure/evidence and integrity tests kept separate from official-scope governance data.
