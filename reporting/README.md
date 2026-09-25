# Reporting

`reporters/` contains the current reporting implementation used by Jenkins and local validation.

## Current responsibilities

- `evidence/` — structured evidence model and Playwright reporter.
- `executive-v3/` — current Executive Dashboard generation.
- `executive/` — previous executive reporter retained for compatibility/tests.
- `preqa2/` — PreQA2 campaign/status reporting.

`reporter-tests/` at repository root contains integrity tests for these reporting layers.

## Target structure

The final repository should expose one obvious reporting boundary:

```text
reporting/
  executive/
  allure/
  evidence/
  preqa2/
  tests/
```

Do not delete `reporters/executive/` or move reporter tests merely because V3 is the current presentation layer; package scripts still exercise historical/current reporters as integrity checks. Consolidation must update those scripts and pass the reporting test suite.
