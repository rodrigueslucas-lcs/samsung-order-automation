const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMarket, reconciliationSummary } = require("../utils/preqa2Reconciliation");

test("reconciliation separates implemented pending TCs from automation gaps", () => {
  const mx = reconcileMarket("MX");
  assert.equal(mx.officialTotal, 37);
  assert.equal(mx.executedCount, 0);
  assert.equal(mx.notRunImplemented.length, mx.implementedCount);
  assert.equal(mx.notRunAutomationGap.length, 37 - mx.implementedCount);
  assert.equal(mx.passImplemented.length, 0);
  assert.equal(mx.passAutomationGap.length, 0);
});

test("all-market reconciliation preserves official totals and current implementation inventory", () => {
  const summary = reconciliationSummary();
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary).map(([market, entry]) => [market, entry.officialTotal])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
  assert.ok(summary.MX.implemented >= 10);
  assert.ok(summary.PE.implemented >= 21);
  assert.ok(summary.CL.implemented >= 1);
  assert.ok(summary.CO.implemented >= 1);
  assert.equal(summary.MX.executed, 0);
  assert.equal(summary.PE.executed, 0);
});
