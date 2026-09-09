const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const { evaluate } = require("../scripts/evaluate-preqa2-ledger.cjs");

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

test("external canonical ledger can be evaluated without replacing tracked evidence", () => {
  const result = evaluate(emptyLedger());
  assert.equal(result.validation.MX.officialTotal, 37);
  assert.equal(result.validation.MX.executed, 0);
  assert.equal(result.campaign.MX.pending, 37);
  assert.ok(result.campaign.MX.registeredPending > 0);
  assert.ok(result.closure.MX.remaining.safe.length > 0);
});

test("external evaluation reflects official live PASS/FAIL independently from automation", () => {
  const ledger = emptyLedger();
  ledger.markets.MX.status = "ACTIVE";
  ledger.markets.MX.results["SAM-24964"] = {
    status: "PASS",
    context: "either",
    runtimePath: "/mx/smartphones/all-smartphones/",
    evidence: "GNB navigation met the official Expected Result.",
    automation: "not-assessed",
    blocker: null,
    validatedAt: "2026-09-09T20:00:00.000Z"
  };
  ledger.markets.MX.results["SAM-24968"] = {
    status: "FAIL",
    context: "either",
    runtimePath: "/mx/smartphones/all-smartphones/",
    evidence: "No usable official facet/filter control was available in the executed scenario.",
    automation: "not-assessed",
    blocker: null,
    validatedAt: "2026-09-09T20:05:00.000Z"
  };
  const result = evaluate(ledger);
  assert.equal(result.validation.MX.executed, 2);
  assert.equal(result.closure.MX.passed, 1);
  assert.equal(result.closure.MX.failed, 1);
  assert.equal(result.campaign.MX.pending, 35);
});
