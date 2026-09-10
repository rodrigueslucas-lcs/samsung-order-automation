const assert = require("node:assert/strict");
const test = require("node:test");
const { buildLegacyReconciliation } = require("../utils/legacyQstReconciliation");

test("legacy reconciliation preserves every historical case without inventing current mappings", () => {
  const report = buildLegacyReconciliation();
  assert.equal(report.historicalTotal, 144);
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.markets).map(([market, rows]) => [market, rows.length])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
  assert.ok(Object.values(report.markets).flat().every((row) => row.currentTemplateMatch === "UNRESOLVED_SOURCE_UNAVAILABLE"));
  assert.equal(report.markets.MX.find(({ officialId }) => officialId === "SAM-25020").legacyContext, "EPP");
  assert.equal(report.markets.MX.find(({ officialId }) => officialId === "SAM-24968").legacyContext, "BASE_STORE");
});
