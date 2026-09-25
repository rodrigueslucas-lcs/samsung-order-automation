# Market-owned automation

Canonical executable automation lives under this directory.

```text
tests/markets/<market>/<qst|dst>/<store>/
```

S1/S2 are selected at runtime and must not create duplicate environment folders here.

Current market owners:

- `mx/` — active MX QST/DST automation.
- `pe/` — canonical PE QST stabilization + established PE DST automation.

CL/CO directories should be introduced here only when their executable lanes are implemented.
