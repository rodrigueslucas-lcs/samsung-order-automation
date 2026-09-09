const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const { reconcileMarket, reconciliationSummary } = require("../utils/preqa2Reconciliation");

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

function pass(runtimePath = "/mx/") {
  return {
    status: "PASS",
    context: "either",
    runtimePath,
    evidence: "Official Expected Result observed in PreQA2.",
    automation: "not-assessed",
    blocker: null,
    validatedAt: "2026-09-09T20:00:00.000Z",
  };
}

test("reconciliation separates implemented pending TCs from automation gaps", () => {
  const sourceLedger = emptyLedger();
  const mx = reconcileMarket("MX", { sourceLedger });
  assert.equal(mx.officialTotal, 37);
  assert.equal(mx.executedCount, 0);
  assert.equal(mx.notRunImplemented.length, mx.implementedCount);
  assert.equal(mx.notRunAutomationGap.length, 37 - mx.implementedCount);
  assert.equal(mx.passImplemented.length, 0);
  assert.equal(mx.passAutomationGap.length, 0);
});

test("reconciliation identifies official PASS without persisted automation", () => {
  const sourceLedger = emptyLedger();
  sourceLedger.markets.MX.status = "ACTIVE";
  sourceLedger.markets.MX.results["SAM-24964"] = pass("/mx/smartphones/all-smartphones/");
  const mx = reconcileMarket("MX", { sourceLedger });
  assert.equal(mx.executedCount, 1);
  assert.ok(mx.passAutomationGap.some((entry) => entry.id === "SAM-24964"));
});

test("all-market reconciliation preserves official totals and implementation inventory", () => {
  const sourceLedger = emptyLedger();
  const summary = reconciliationSummary({ sourceLedger });
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
