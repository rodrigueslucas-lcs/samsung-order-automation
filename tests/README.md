# Tests

This directory is executable Playwright automation organized by **ownership**, not by staging environment.

## Canonical layout

```text
tests/
├── markets/
│   ├── mx/
│   │   ├── qst/
│   │   └── dst/
│   └── pe/
│       ├── qst/
│       └── dst/
├── shared/
│   └── smb/
│       └── qst/
└── legacy/
    └── pe/
        └── qst/
```

## Rule

S1/S2 are runtime environments. They no longer define physical test folders.

Use:

```text
tests/markets/<market>/<qst|dst>/<store>/
```

and select S1/S2 through configuration/environment variables.

## Ownership

- `markets/mx/qst/base-store` — active MX QST implementation and official 29-TC Base Store P1 runner.
- `markets/mx/dst` — MX DST plus authenticated fixture/flow compatibility used by current QST specs.
- `markets/pe/qst` — newer/canonical PE QST stabilization generation.
- `markets/pe/dst` — established PE DST generation.
- `shared/smb/qst` — genuinely shared/regional candidates.
- `legacy/pe/qst` — older PE QST generation retained only for reconciliation and compatibility commands.

A new test must not be copied into separate S1 and S2 folders. One spec should route endpoints/configuration at runtime whenever the business flow is equivalent.

## Legacy rule

Anything under `tests/legacy/` is explicitly non-canonical. It may remain executable while reconciliation is unfinished, but new feature work must not be added there unless the purpose is maintaining a legacy compatibility lane.

## Regression gate

For MX-affecting structural changes, the runtime baseline remains the official 29-TC Base Store campaign:

```text
29 selected / 29 executed
28 PASS
1 known functional FAIL: SAM-25010 Track Order
0 BLOCKED / 0 NOT_RUN
```

Run the structural guard after path changes:

```bash
npm run repo:architecture:validate
```
