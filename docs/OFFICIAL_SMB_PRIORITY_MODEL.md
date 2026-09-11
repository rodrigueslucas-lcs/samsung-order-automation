# Official SMB priority and cycle model

The canonical business rule is:

- P1 is included in QST and DST.
- P2 is excluded from QST and included in DST.

Priority is market- and store-context-specific. Base Store and EPP are independent inventories. Runtime results, implementation presence, automation completeness, priority, and cycle scope are separate dimensions.

## Source state

The four current Samsung Confluence Markdown exports in `docs/smb_priority_templates/` are authoritative for scenario wording and Priority. The importer validates every serial and keeps Base Store and EPP independent.

| Market | Base Store (P1/P2) | EPP (P1/P2) | QST/P1 | DST |
| --- | ---: | ---: | ---: | ---: |
| MX | 56 (30/26) | 36 (8/28) | 38 | 92 |
| PE | 55 (28/27) | 37 (6/31) | 34 | 92 |
| CL | 53 (31/22) | 36 (7/29) | 38 | 89 |
| CO | 54 (28/26) | 35 (6/29) | 34 | 89 |
| **SMB** | **218 (117/101)** | **144 (27/117)** | **144** | **362** |

The 2026-09-02 Zephyr campaign remains a historical 144-ID inventory (MX 37, CL 38, CO 35, PE 34). Its coincidental total equality with current P1 does not make it the current denominator. `npm run qst:reconcile:legacy:mx` preserves every historical ID and reports conservative match confidence against current source rows.

## Required source fields

Each imported row retains a stable source row key, serial, market, context, exact scenario cell, source filename and P1/P2 priority. These source templates do not contain a separate Expected Result column, so no Expected Result is fabricated. Samsung ID is optional and is attached only where existing detailed repository metadata proves the relationship.

Run `npm run qst:cycle:status` for readable output or `npm run qst:cycle:status:json` for dashboard/CI input. The report calculates QST only from P1 and DST from P1 plus P2. It will not use the legacy 144-case campaign as the new denominator.
