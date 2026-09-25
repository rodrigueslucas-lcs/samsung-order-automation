# Reporting Integrity Tests

`reporter-tests/` validates evidence, Executive Dashboard, Allure integration, runtime summaries and reporting isolation. These tests protect generated artifacts and presentation behavior; they are not storefront business TCs.

The long-term target is `reporting/tests/` so reporting implementation and its integrity suite have one obvious home.

Until that migration is performed atomically, keep these paths stable because `package.json` scripts reference them directly.
