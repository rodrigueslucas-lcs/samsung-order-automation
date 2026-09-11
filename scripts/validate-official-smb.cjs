const { validateOfficialInventory, buildCycleReport } = require("../utils/officialSmbInventory");
const { buildLegacyReconciliation } = require("../utils/legacyQstReconciliation");

const inventory = validateOfficialInventory(undefined, { requireSources: true });
const cycle = buildCycleReport();
const legacy = buildLegacyReconciliation();
if (cycle.aggregate.qst !== cycle.aggregate.p1) throw new Error("Official gate: QST must equal P1");
if (cycle.aggregate.dst !== cycle.aggregate.p1 + cycle.aggregate.p2) throw new Error("Official gate: DST must equal P1 + P2");
if (legacy.historicalTotal !== 144) throw new Error("Official gate: historical 144-case evidence was not preserved");
console.log(`[official-smb] PASS rows=${inventory.representedRows} QST/P1=${cycle.aggregate.qst} P2=${cycle.aggregate.p2} DST=${cycle.aggregate.dst} legacy=${legacy.historicalTotal}`);
