# Shared SMB automation

`tests/markets/shared` contains tests that are intentionally reusable across markets and whose business assertion is genuinely shared.

Shared does **not** mean generic by default. A test belongs here only when its market applicability is explicit and configuration carries the market-specific behavior.

## Rules

- official shared QST titles must carry exactly one market tag when they represent a market-specific official SAM ID;
- market-specific selectors, payment modes, credentials and business rules stay in market config/helpers rather than being hidden inside shared specs;
- if a scenario diverges materially by market, keep a market-owned spec and share only the lower-level flow/page primitive;
- new code must use `tests/markets/shared`, never the hidden `tests/s1/smb` compatibility mirror.

Architecture/governance checks validate shared-market tagging and canonical paths.
