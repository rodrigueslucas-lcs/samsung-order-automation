const assert = require("node:assert/strict");
const test = require("node:test");
const { buildLegacyReconciliation } = require("../utils/legacyQstReconciliation");

test("legacy reconciliation preserves every historical case and uses conservative current mappings", () => {
  const report = buildLegacyReconciliation();
  assert.equal(report.historicalTotal, 144);
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.markets).map(([market, rows]) => [market, rows.length])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
  assert.equal(Object.values(report.counts).reduce((sum, count) => sum + count, 0), 144);
  assert.ok(report.markets.MX.some((row) => row.classification === "CONFIDENT_MATCH"));
  assert.ok(report.markets.CL.some((row) => row.classification === "NO_CURRENT_MATCH"));
  assert.equal(report.markets.MX.find(({ officialId }) => officialId === "SAM-25020").legacyContext, "EPP");
  assert.equal(report.markets.MX.find(({ officialId }) => officialId === "SAM-24968").legacyContext, "BASE_STORE");
});
