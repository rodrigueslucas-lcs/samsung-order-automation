# Reporting Integrity Tests

`reporters/tests/` validates evidence, Executive Dashboard, Allure integration, runtime summaries and reporting isolation. These tests protect generated artifacts and presentation behavior; they are not storefront business TCs.

Reporting implementation and its integrity tests now share one obvious top-level boundary under `reporters/`.

Fixtures used only by reporting tests live under `reporters/tests/fixtures/`.
