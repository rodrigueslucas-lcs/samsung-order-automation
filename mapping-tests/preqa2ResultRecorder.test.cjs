const test = require("node:test");
const assert = require("node:assert/strict");
const baseLedger = require("../test-mapping/preqa2-validation.json");
const {
  applyResultToLedger,
  buildRecordedResult,
  normalizeStatus,
} = require("../utils/preqa2ResultRecorder");

test("recorder builds evidence-backed PASS and strips sensitive URL data", () => {
  const result = buildRecordedResult({
    market: "MX",
    id: "SAM-24968",
    status: "pass",
    runtimeUrl: "https://p6-pre-qa2.samsung.com/mx/smartphones/?token=secret#facet",
    context: "guest",
    evidence: "Facet Brand selected and PLP product result state changed.",
    automation: "candidate",
    validatedAt: "2026-09-09T20:00:00.000Z",
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.runtimePath, "/mx/smartphones/");
  assert.equal(result.title, "Facets/Filter");
  assert.equal(result.feature, "Product");
  assert.equal(result.context, "guest");
});

test("PASS cannot be recorded without evidence", () => {
  assert.throws(
    () => buildRecordedResult({ market: "MX", id: "SAM-24968", status: "PASS" }),
    /PASS requires runtime evidence/
  );
});

test("BLOCKED cannot be recorded without a blocker", () => {
  assert.throws(
    () => buildRecordedResult({ market: "MX", id: "SAM-24968", status: "BLOCKED", evidence: "Attempted" }),
    /BLOCKED requires a concrete blocker/
  );
});

test("ledger update preserves official totals and activates market", () => {
  const recorded = buildRecordedResult({
    market: "MX",
    id: "SAM-24968",
    status: "PASS",
    runtimeUrl: "/mx/smartphones/",
    evidence: "Official facet result proven.",
  });
  const next = applyResultToLedger(baseLedger, "MX", "SAM-24968", recorded);
  assert.equal(next.markets.MX.officialTotal, 37);
  assert.equal(next.markets.MX.status, "ACTIVE");
  assert.equal(next.markets.MX.results["SAM-24968"].status, "PASS");
  assert.equal(baseLedger.markets.MX.results["SAM-24968"], undefined);
});

test("unsupported statuses and non-official IDs fail closed", () => {
  assert.throws(() => normalizeStatus("maybe"), /Unsupported/);
  assert.throws(
    () => buildRecordedResult({ market: "MX", id: "SAM-00000", status: "FAIL", evidence: "x" }),
    /not an official/
  );
});
