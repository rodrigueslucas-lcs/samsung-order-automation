# Legacy compatibility automation

This directory contains executable compatibility suites that are intentionally outside the current market-owned architecture.

Today it contains the older PE/ST2 QST generation. Legacy code remains runnable only while explicit compatibility npm entry points exist.

Do not add new regional coverage here. Migrate unique coverage to `tests/markets/<market>/...`, retire callers, then delete the legacy implementation.
