# Official SMB priority and cycle model

The canonical business rule is:

- P1 is included in QST and DST.
- P2 is excluded from QST and included in DST.

Priority is market- and store-context-specific. Base Store and EPP are independent inventories. Runtime results, implementation presence, automation completeness, priority, and cycle scope are separate dimensions.

## Source state

The repository currently has the legacy 2026-09-02 Zephyr execution campaign with 144 IDs (MX 37, CL 38, CO 35, PE 34). It also has execution CSV exports and derived workbooks created on 2026-09-08. None of the available files contains the new authoritative Priority column or the larger current Base Store plus EPP inventories described in the updated Samsung templates.

For that reason, `test-mapping/official-smb-inventory.json` intentionally contains no inferred rows and reports `BLOCKED_MISSING_UPDATED_EXPORTS`. Zeroes printed while blocked mean no current official rows have been imported; they are not official scenario totals.

The legacy IDs remain available through `test-mapping/smb-qst.json`, the execution ledger, and `npm run qst:reconcile:legacy:mx`. Every legacy ID is retained as unresolved against the missing current source rather than silently deleted or matched by title.

## Required source fields

Each imported current-template row must retain a stable source row key, market, context, scenario, Expected Result, and P1/P2 priority. Samsung ID is optional only when the template row cannot be mapped confidently. Such rows remain represented by the source row key; an ID must never be manufactured.

Run `npm run qst:cycle:status` for readable output or `npm run qst:cycle:status:json` for dashboard/CI input. The report calculates QST only from P1 and DST from P1 plus P2. It will not use the legacy 144-case campaign as the new denominator.
