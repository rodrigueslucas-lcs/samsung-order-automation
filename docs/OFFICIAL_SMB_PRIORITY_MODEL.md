# Official SMB priority and cycle model

The canonical business rule is:

- P1 is included in QST and DST.
- P2 is excluded from QST and included in DST.

Priority is market- and store-context-specific. Base Store and EPP are independent inventories. Runtime results, implementation presence, automation completeness, priority, cycle scope and temporary market applicability exclusions are separate dimensions.

## Source state

The four current Samsung Confluence Markdown exports in `docs/smb_priority_templates/` are authoritative for source scenario wording and Priority. The importer validates every serial and keeps Base Store and EPP independent.

| Market | Base Store (P1/P2) | EPP (P1/P2) | Source QST/P1 | DST |
| --- | ---: | ---: | ---: | ---: |
| MX | 56 (30/26) | 36 (8/28) | 38 | 92 |
| PE | 55 (28/27) | 37 (6/31) | 34 | 92 |
| CL | 53 (31/22) | 36 (7/29) | 38 | 89 |
| CO | 54 (28/26) | 35 (6/29) | 34 | 89 |
| **SMB** | **218 (117/101)** | **144 (27/117)** | **144** | **362** |

These numbers describe the **source priority inventory**. They must not be silently rewritten to match a temporary active automation exclusion.

### MX active-runner applicability exception

MX Base Store has 30 source P1 rows. `SAM-25006` is currently preserved as a source P1 row but excluded from the active MX Base Store runner because Samsung SMB QA clarified that the PSE bank-payment path in the inherited test data is Colombia-specific and is not a valid MX payment path.

As a result:

- source MX Base Store P1 rows: **30**;
- active MX Base Store runner: **29**;
- source MX total P1 rows including EPP: **38**.

The distinction is intentional: source scope remains auditable while runtime selection reflects current market applicability.

The 2026-09-02 Zephyr campaign remains a historical 144-ID inventory (MX 37, CL 38, CO 35, PE 34). Its coincidental total equality with current source P1 does not make it the current denominator. `npm run qst:reconcile:legacy:mx` preserves every historical ID and reports conservative match confidence against current source rows.

## Required source fields

Each imported row retains a stable source row key, serial, market, context, exact scenario cell, source filename and P1/P2 priority. These source templates do not contain a separate Expected Result column, so no Expected Result is fabricated. Samsung ID is optional and is attached only where existing detailed repository metadata proves the relationship.

Run `npm run qst:cycle:status` for readable output or `npm run qst:cycle:status:json` for dashboard/CI input. The source-scope report calculates QST only from P1 and DST from P1 plus P2. It will not use the legacy 144-case campaign as the new denominator.

For the active MX automation selection and the `SAM-25006` audit exclusion, use `MX_QST_COVERAGE_MATRIX.md` and `REPOSITORY_AUDIT.md`.
